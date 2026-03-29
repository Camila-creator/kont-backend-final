const { pool } = require("../db");

// GET /api/caja/resumen?date=YYYY-MM-DD
exports.getResumenDiario = async (req, res) => {
    try {
        const { date } = req.query;
        const tenantId = req.user.tenantId;

        if (!date) {
            return res.status(400).json({ error: "Falta la fecha (date)" });
        }

        // Ejecutamos TODAS las consultas en paralelo para que sea ultra rápido
        const [
            qTasa, 
            qIngresos, 
            qEgresos, 
            qMovimientos, 
            qEstado, 
            qMetodos, 
            qCuentas, 
            qProductos
        ] = await Promise.all([
            
            // 1. Tasa de Cambio (USD)
            pool.query(
                `SELECT rate_value FROM exchange_rates 
                 WHERE tenant_id = $1 AND currency_code = 'USD' 
                 ORDER BY effective_date DESC LIMIT 1`,
                [tenantId]
            ),

            // 2. Total Ingresos
            pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments 
                 WHERE paid_at::date = $1::date AND tenant_id = $2`,
                [date, tenantId]
            ),

            // 3. Total Egresos
            pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments 
                 WHERE created_at::date = $1::date AND tenant_id = $2`,
                [date, tenantId]
            ),

            // 4. Historial Detallado (Ahora incluye el nombre de la cuenta)
            pool.query(
                `SELECT cp.paid_at as created_at, 'INGRESO' as tipo, 
                        'Venta / Cliente' as descripcion, cp.method as metodo_pago, 
                        cp.amount as monto, fa.name as cuenta 
                 FROM customer_payments cp
                 LEFT JOIN finance_accounts fa ON fa.id = cp.finance_account_id
                 WHERE cp.paid_at::date = $1::date AND cp.tenant_id = $2
                 
                 UNION ALL
                 
                 SELECT sp.created_at, 'EGRESO' as tipo, 
                        'Gasto / Proveedor' as descripcion, sp.method as metodo_pago, 
                        sp.amount as monto, fa.name as cuenta 
                 FROM supplier_payments sp
                 LEFT JOIN finance_accounts fa ON fa.id = sp.finance_account_id
                 WHERE sp.created_at::date = $1::date AND sp.tenant_id = $2
                 
                 ORDER BY created_at DESC`,
                [date, tenantId]
            ),

            // 5. Estado de Cierre
            pool.query(
                `SELECT * FROM cash_register_closures WHERE closure_date = $1::date AND tenant_id = $2`,
                [date, tenantId]
            ),

            // 6. TOTAL POR MÉTODO DE PAGO (Zelle, Efectivo, Pago Móvil...)
            pool.query(
                `SELECT method as metodo, COALESCE(SUM(amount), 0) as total 
                 FROM customer_payments 
                 WHERE paid_at::date = $1::date AND tenant_id = $2 
                 GROUP BY method 
                 ORDER BY total DESC`,
                [date, tenantId]
            ),

            // 7. TOTAL POR CUENTA FINANCIERA (Banesco, Caja Fuerte, Chase...)
            pool.query(
                `SELECT fa.name as cuenta, fa.type as tipo, COALESCE(SUM(cp.amount), 0) as total 
                 FROM customer_payments cp
                 JOIN finance_accounts fa ON fa.id = cp.finance_account_id
                 WHERE cp.paid_at::date = $1::date AND cp.tenant_id = $2
                 GROUP BY fa.id, fa.name, fa.type
                 ORDER BY total DESC`,
                [date, tenantId]
            ),

            // 8. PRODUCTOS VENDIDOS EN EL DÍA (Ranking)
            pool.query(
                `SELECT p.name as producto, SUM(oi.qty) as cantidad_vendida, SUM(oi.total) as total_generado
                 FROM order_items oi
                 JOIN products p ON p.id = oi.product_id
                 JOIN orders o ON o.id = oi.order_id
                 WHERE o.order_date::date = $1::date AND o.tenant_id = $2
                 GROUP BY p.id, p.name
                 ORDER BY cantidad_vendida DESC`,
                [date, tenantId]
            )
        ]);

        const tasaDelDia = parseFloat(qTasa.rows[0]?.rate_value || 0);

        res.json({
            data: {
                tasa: tasaDelDia,
                ingresos: parseFloat(qIngresos.rows[0]?.total || 0),
                egresos: parseFloat(qEgresos.rows[0]?.total || 0),
                estado: qEstado.rows.length > 0 ? 'CERRADA' : 'ABIERTA',
                movimientos: qMovimientos.rows,
                // AQUÍ VAN TUS NUEVOS DATOS MAGISTRALES:
                desgloseMetodos: qMetodos.rows, 
                desgloseCuentas: qCuentas.rows,
                productosVendidos: qProductos.rows
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

        // 1. Validar si ya está cerrada
        const checkCierre = await pool.query(
            `SELECT id FROM cash_register_closures WHERE closure_date = $1::date AND tenant_id = $2`,
            [fecha, tenantId]
        );

        if (checkCierre.rows.length > 0) {
            return res.status(400).json({ error: "La caja de este día ya fue cerrada anteriormente." });
        }

        const diferencia = Number(saldo_real) - Number(saldo_esperado);

        // 2. Insertar el cierre
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