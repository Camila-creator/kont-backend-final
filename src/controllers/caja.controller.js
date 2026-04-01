// src/controllers/caja.controller.js
// LÓGICA 2 FIX: reemplazado pool.query por db.query en todas las queries con tenant_id
// Nota: Promise.all no se puede usar con db.query (que usa transacciones secuenciales),
//       así que ejecutamos en paralelo con pool.connect + SET LOCAL para mantener el RLS.
const db = require("../db");
const audit = require("./audit.controller");

// GET /api/caja/resumen?date=YYYY-MM-DD
exports.getResumenDiario = async (req, res) => {
  try {
    const { date } = req.query;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    if (!date) {
      return res.status(400).json({ error: "Falta la fecha (date)" });
    }

    // Validar que date sea una fecha válida — evita inyección en el cast
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Formato de fecha inválido. Usa YYYY-MM-DD." });
    }

    // Usamos un cliente con RLS activado para todas las queries del resumen
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId.toString()]);

      const [
        qTasa, qIngresos, qEgresos, qMovimientos,
        qEstado, qMetodos, qCuentas, qProductos,
      ] = await Promise.all([

        client.query(
          `SELECT rate_value FROM exchange_rates
           WHERE tenant_id = $1 AND currency_code = 'USD'
           ORDER BY effective_date DESC LIMIT 1`,
          [tenantId]
        ),

        client.query(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM customer_payments
           WHERE paid_at::date = $1::date AND tenant_id = $2`,
          [date, tenantId]
        ),

        client.query(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM supplier_payments
           WHERE created_at::date = $1::date AND tenant_id = $2`,
          [date, tenantId]
        ),

        client.query(
          `SELECT cp.paid_at AS created_at, 'INGRESO' AS tipo,
                  'Venta / Cliente' AS descripcion, cp.method AS metodo_pago,
                  cp.amount AS monto, fa.name AS cuenta
           FROM customer_payments cp
           LEFT JOIN finance_accounts fa ON fa.id = cp.finance_account_id
           WHERE cp.paid_at::date = $1::date AND cp.tenant_id = $2

           UNION ALL

           SELECT sp.created_at, 'EGRESO' AS tipo,
                  'Gasto / Proveedor' AS descripcion, sp.method AS metodo_pago,
                  sp.amount AS monto, fa.name AS cuenta
           FROM supplier_payments sp
           LEFT JOIN finance_accounts fa ON fa.id = sp.finance_account_id
           WHERE sp.created_at::date = $1::date AND sp.tenant_id = $2

           ORDER BY created_at DESC`,
          [date, tenantId]
        ),

        client.query(
          `SELECT * FROM cash_register_closures
           WHERE closure_date = $1::date AND tenant_id = $2`,
          [date, tenantId]
        ),

        client.query(
          `SELECT method AS metodo, COALESCE(SUM(amount), 0) AS total
           FROM customer_payments
           WHERE paid_at::date = $1::date AND tenant_id = $2
           GROUP BY method ORDER BY total DESC`,
          [date, tenantId]
        ),

        client.query(
          `SELECT fa.name AS cuenta, fa.type AS tipo, COALESCE(SUM(cp.amount), 0) AS total
           FROM customer_payments cp
           JOIN finance_accounts fa ON fa.id = cp.finance_account_id
           WHERE cp.paid_at::date = $1::date AND cp.tenant_id = $2
           GROUP BY fa.id, fa.name, fa.type ORDER BY total DESC`,
          [date, tenantId]
        ),

        client.query(
          `SELECT p.name AS producto, SUM(oi.qty) AS cantidad_vendida, SUM(oi.total) AS total_generado
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           JOIN orders o ON o.id = oi.order_id
           WHERE o.order_date::date = $1::date AND o.tenant_id = $2
           GROUP BY p.id, p.name ORDER BY cantidad_vendida DESC`,
          [date, tenantId]
        ),
      ]);

      await client.query("COMMIT");

      res.json({
        data: {
          tasa: parseFloat(qTasa.rows[0]?.rate_value || 0),
          ingresos: parseFloat(qIngresos.rows[0]?.total || 0),
          egresos: parseFloat(qEgresos.rows[0]?.total || 0),
          estado: qEstado.rows.length > 0 ? "CERRADA" : "ABIERTA",
          movimientos: qMovimientos.rows,
          desgloseMetodos: qMetodos.rows,
          desgloseCuentas: qCuentas.rows,
          productosVendidos: qProductos.rows,
        },
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error("Error en resumen de caja:", error.message);
    res.status(500).json({ error: "Error al cargar el resumen de caja" });
  }
};

// POST /api/caja/cierre
exports.cerrarCaja = async (req, res) => {
  try {
    const { fecha, saldo_esperado, saldo_real, notas, exchange_rate } = req.body;
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const userId = req.user.id || req.user.userId;

    if (!fecha || saldo_esperado === undefined || saldo_real === undefined) {
      return res.status(400).json({ error: "Fecha, saldo esperado y saldo real son obligatorios." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: "Formato de fecha inválido. Usa YYYY-MM-DD." });
    }

    // Verificar si ya está cerrada
    const check = await db.query(
      `SELECT id FROM cash_register_closures WHERE closure_date = $1::date AND tenant_id = $2`,
      [fecha, tenantId],
      tenantId
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ error: "La caja de este día ya fue cerrada." });
    }

    const diferencia = Number(saldo_real) - Number(saldo_esperado);

    await db.query(
      `INSERT INTO cash_register_closures
       (tenant_id, closed_by, closure_date, expected_amount, actual_amount, difference, exchange_rate, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, userId, fecha, saldo_esperado, saldo_real, diferencia, exchange_rate || 1, notas || null],
      tenantId
    );

    await audit.saveAuditLogInternal({
      tenant_id: tenantId, user_id: userId, user_name: req.user.name,
      module: "FINANZAS", action: "CIERRE_CAJA",
      description: `Caja cerrada para ${fecha}. Diferencia: ${diferencia}`,
    });

    res.json({ message: "Caja cerrada exitosamente", diferencia });

  } catch (error) {
    console.error("Error al cerrar caja:", error.message);
    res.status(500).json({ error: "Error interno al cerrar la caja" });
  }
};
