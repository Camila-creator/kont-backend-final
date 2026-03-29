const { pool } = require("../db");

// GET /api/caja/resumen?date=YYYY-MM-DD
exports.getResumenDiario = async (req, res) => {
    try {
        const { date } = req.query;
        const tenantId = req.user.tenantId;

        if (!date) {
            return res.status(400).json({ error: "Falta la fecha (date)" });
        }

        // 1. Obtener la Tasa de Cambio más reciente (USD)
        const qTasa = await pool.query(
            `SELECT rate_value FROM exchange_rates 
             WHERE tenant_id = $1 AND currency_code = 'USD' 
             ORDER BY effective_date DESC LIMIT 1`,
            [tenantId]
        );
        const tasaDelDia = parseFloat(qTasa.rows[0]?.rate_value || 0);

        // 2. Calcular Ingresos (Ventas de ese día)
        const qIngresos = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments 
             WHERE paid_at::date = $1::date AND tenant_id = $2`,
            [date, tenantId]
        );

        // 3. Calcular Egresos (Gastos/Pagos de ese día)
        const qEgresos = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments 
             WHERE created_at::date = $1::date AND tenant_id = $2`,
            [date, tenantId]
        );

        // 4. Obtener el historial de movimientos (UNION de pagos de clientes y proveedores)
        const qMovimientos = await pool.query(
            `
            SELECT paid_at as created_at, 'INGRESO' as tipo, 'Venta / Pago de cliente' as descripcion, method as metodo_pago, amount as monto 
            FROM customer_payments 
            WHERE paid_at::date = $1::date AND tenant_id = $2
            
            UNION ALL
            
            SELECT created_at, 'EGRESO' as tipo, 'Pago a proveedor / Gasto' as descripcion, method as metodo_pago, amount as monto 
            FROM supplier_payments 
            WHERE created_at::date = $1::date AND tenant_id = $2
            
            ORDER BY created_at DESC
            `,
            [date, tenantId]
        );

        // 5. Verificar estado de la caja
        const qEstado = await pool.query(
            `SELECT * FROM cash_register_closures WHERE closure_date = $1::date AND tenant_id = $2`,
            [date, tenantId]
        );

        res.json({
            data: {
                tasa: tasaDelDia, // Enviamos la tasa para el cálculo en el frontend
                ingresos: parseFloat(qIngresos.rows[0].total),
                egresos: parseFloat(qEgresos.rows[0].total),
                estado: qEstado.rows.length > 0 ? 'CERRADA' : 'ABIERTA',
                movimientos: qMovimientos.rows
            }
        });

    } catch (error) {
        console.error("❌ ERROR EN RESUMEN DE CAJA:", error);
        res.status(500).json({ error: "Error al cargar el resumen de caja" });
    }
};

// POST /api/caja/cierre
exports.cerrarCaja = async (req, res) => {
    try {
        const { fecha, saldo_esperado, saldo_real, notas } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.userId; 

        // 1. Validar si ya está cerrada para evitar duplicados
        const checkCierre = await pool.query(
            `SELECT id FROM cash_register_closures WHERE closure_date = $1::date AND tenant_id = $2`,
            [fecha, tenantId]
        );

        if (checkCierre.rows.length > 0) {
            return res.status(400).json({ error: "La caja de este día ya fue cerrada anteriormente." });
        }

        const diferencia = Number(saldo_real) - Number(saldo_esperado);

        // 2. Insertar el cierre con el snapshot de la diferencia
        // Nota: Si en tu tabla agregaste la columna 'exchange_rate', podrías guardarla aquí también.
        await pool.query(
            `INSERT INTO cash_register_closures 
            (tenant_id, closed_by, closure_date, expected_amount, actual_amount, difference, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [tenantId, userId, fecha, saldo_esperado, saldo_real, diferencia, notas]
        );

        res.json({ message: "Caja cerrada exitosamente" });

    } catch (error) {
        console.error("❌ ERROR AL CERRAR CAJA:", error);
        res.status(500).json({ error: "Error interno al cerrar la caja" });
    }
};