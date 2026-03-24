const db = require("../db");

exports.getDashboardData = async (startDate, endDate, tenantId) => {
    // Función auxiliar para ejecutar queries sin que maten el proceso
    const safeQuery = async (q, p) => {
        try {
            return await db.query(q, p, tenantId);
        } catch (e) {
            console.warn("⚠️ Query fallida (posible tabla faltante):", e.message);
            return { rows: [] };
        }
    };

    // 1. KPIs de Ingresos y Egresos
    const resIng = await safeQuery(`SELECT SUM(amount) as total FROM customer_payments WHERE paid_at >= $1 AND paid_at <= $2 AND tenant_id = $3`, [startDate, endDate, tenantId]);
    
    // Si esta tabla falla, devolvemos 0
    const resEgr = await safeQuery(`SELECT SUM(amount) as total FROM supplier_payments WHERE created_at >= $1 AND created_at <= $2 AND tenant_id = $3`, [startDate, endDate, tenantId]);

    // 2. Cuentas y su Balance (Asegúrate de que supplier_payments exista)
    const qAccounts = `
        SELECT 
            a.id, a.name, a.currency, 
            COALESCE(b.name, 'Sin Banco') as bank_name,
            (
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE finance_account_id = a.id AND tenant_id = $1), 0) - 
                COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE finance_account_id = a.id AND tenant_id = $1), 0)
            ) as balance
        FROM finance_accounts a
        LEFT JOIN finance_banks b ON a.bank_id = b.id
        WHERE a.is_active = true AND a.tenant_id = $1
        ORDER BY a.name ASC;
    `;
    const resAcc = await safeQuery(qAccounts, [tenantId]);

    // 3. Métodos
    const resMeth = await safeQuery(`SELECT method, SUM(amount) as total FROM customer_payments WHERE paid_at >= $1 AND paid_at <= $2 AND tenant_id = $3 GROUP BY method`, [startDate, endDate, tenantId]);

    return {
        ingresos: parseFloat(resIng.rows[0]?.total || 0),
        egresos: parseFloat(resEgr.rows[0]?.total || 0),
        accounts: resAcc.rows,
        methodsIn: resMeth.rows,
        muro: {
            mejor_cliente: { nombre: 'N/A', monto: 0 },
            deudor_cliente: { nombre: 'N/A', monto: 0 },
            mejor_proveedor: { nombre: 'N/A', monto: 0 },
            deudor_proveedor: { nombre: 'N/A', monto: 0 }
        }
    };
};