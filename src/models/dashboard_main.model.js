const db = require("../db");

exports.getMainDashboardData = async (startOfMonth, sevenDaysAgo, todayStr, tenantId) => {
    try {
        // 1. VENTAS DEL MES (Ingresos reales de pagos confirmados)
        const qVentas = `
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM customer_payments 
            WHERE paid_at >= $1 AND tenant_id = $2
        `;
        const resVentas = await db.query(qVentas, [startOfMonth, tenantId], tenantId).catch(() => ({ rows: [{ total: 0 }] }));
        
        // 2. PEDIDOS ACTIVOS (Pendientes o en proceso)
        const qPedidos = `
            SELECT COUNT(*) as total 
            FROM orders 
            WHERE (status ILIKE '%PENDING%' OR status ILIKE '%PROCESSING%') 
            AND tenant_id = $1
        `;
        const resPedidos = await db.query(qPedidos, [tenantId], tenantId).catch(() => ({ rows: [{ total: 0 }] }));

        // 3. CUENTAS POR COBRAR (CxC)
        const qCxC = `
            SELECT COALESCE(SUM(oi.total), 0) as total 
            FROM orders o 
            JOIN order_items oi ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
            WHERE (o.status ILIKE '%PENDING%' OR o.status ILIKE '%CREDIT%')
            AND o.tenant_id = $1
        `;
        const resCxC = await db.query(qCxC, [tenantId], tenantId).catch(() => ({ rows: [{ total: 0 }] }));

        // 4. STOCK CRÍTICO
        const qStock = `
            SELECT id, name as nombre, stock as actual, min_stock as minimo
            FROM products 
            WHERE stock <= min_stock AND tenant_id = $1
            ORDER BY stock ASC LIMIT 5
        `;
        const resStock = await db.query(qStock, [tenantId], tenantId).catch(() => ({ rows: [] }));

        // 5. GRÁFICA: VENTAS VS COMPRAS (7 días)
        const qChartVentas = `
            SELECT DATE(paid_at) as fecha, SUM(amount) as total 
            FROM customer_payments 
            WHERE paid_at >= $1 AND tenant_id = $2
            GROUP BY DATE(paid_at) ORDER BY fecha ASC
        `;
        const qChartCompras = `
            SELECT DATE(created_at) as fecha, SUM(total) as total 
            FROM purchases 
            WHERE created_at >= $1 AND tenant_id = $2
            GROUP BY DATE(created_at) ORDER BY fecha ASC
        `;
        const resChartVentas = await db.query(qChartVentas, [sevenDaysAgo, tenantId], tenantId).catch(() => ({ rows: [] }));
        const resChartCompras = await db.query(qChartCompras, [sevenDaysAgo, tenantId], tenantId).catch(() => ({ rows: [] }));

        // 6. ÚLTIMOS PEDIDOS (Corregido c.name -> c.nombre)
        const qRecentOrders = `
            SELECT 
    o.id, 
    c.name as cliente, -- ✅ CORREGIDO: Antes decía c.nombre
    o.status, 
    COALESCE(SUM(oi.total), 0) as total, 
    o.created_at
FROM orders o
JOIN customers c ON o.customer_id = c.id AND o.tenant_id = c.tenant_id
LEFT JOIN order_items oi ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
WHERE o.tenant_id = $1
GROUP BY o.id, c.name, o.status, o.created_at -- ✅ CORREGIDO
ORDER BY o.created_at DESC LIMIT 5
        `;
        const resRecentOrders = await db.query(qRecentOrders, [tenantId], tenantId).catch(() => ({ rows: [] }));

        // 7. PAGOS URGENTES (Corregido s.name -> s.nombre) 🚀
        const qUrgent = `
            SELECT s.nombre as proveedor, p.due_date as vence, p.total 
            FROM purchases p 
            JOIN suppliers s ON p.supplier_id = s.id AND p.tenant_id = s.tenant_id
            WHERE p.status ILIKE '%PENDING%' AND p.tenant_id = $1
            ORDER BY p.due_date ASC NULLS LAST LIMIT 5
        `;
        const resUrgent = await db.query(qUrgent, [tenantId], tenantId).catch(() => ({ rows: [] }));

        // ... dentro de getDashboardData
const qAccounts = `
    SELECT 
        a.id, 
        a.name, 
        a.currency, 
        COALESCE(b.name, 'Sin Banco') as bank_name,
        -- Verificamos si esta cuenta está en la tabla de ruteo como activa
        EXISTS(
            SELECT 1 FROM finance_method_routing fmr 
            WHERE fmr.account_id = a.id 
            AND fmr.tenant_id = $1
        ) as is_default,
        -- Balance: Usamos COALESCE en cada parte para evitar el error de "null"
        (
            COALESCE((SELECT SUM(amount) FROM customer_payments WHERE finance_account_id = a.id AND tenant_id = $1), 0) - 
            COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE finance_account_id = a.id AND tenant_id = $1), 0)
        ) as balance
    FROM finance_accounts a
    LEFT JOIN finance_banks b ON a.bank_id = b.id
    WHERE a.is_active = true AND a.tenant_id = $1
    ORDER BY is_default DESC, balance DESC;
`;

        // 8. MARKETING RESUMEN
        const qMktAds = `SELECT COALESCE(SUM(presupuesto_diario * 30), 0) as t FROM mkt_ads_campaigns WHERE fecha_inicio >= $1 AND tenant_id = $2`;
        const qMktOff = `SELECT COALESCE(SUM(gasto_real), 0) as t FROM mkt_offline_activities WHERE fecha_inicio >= $1 AND tenant_id = $2`;
        const qMktInf = `SELECT COALESCE(SUM(inversion), 0) as t FROM mkt_influencers WHERE fecha_inicio >= $1 AND tenant_id = $2`;
        const qMetrics = `SELECT * FROM mkt_monthly_metrics WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`;

        const [rAds, rOff, rInf, rMetrics] = await Promise.all([
            db.query(qMktAds, [startOfMonth, tenantId], tenantId).catch(()=>({rows:[{t:0}]})),
            db.query(qMktOff, [startOfMonth, tenantId], tenantId).catch(()=>({rows:[{t:0}]})),
            db.query(qMktInf, [startOfMonth, tenantId], tenantId).catch(()=>({rows:[{t:0}]})),
            db.query(qMetrics, [tenantId], tenantId).catch(()=>({rows:[]}))
        ]);

        const gastoMkt = parseFloat(rAds.rows[0].t) + parseFloat(rOff.rows[0].t) + parseFloat(rInf.rows[0].t);
        const metricas = rMetrics.rows[0] || {};
        const totalVentas = parseFloat(resVentas.rows[0].total);

        return {
            ventasMes: totalVentas,
            pedidosActivos: parseInt(resPedidos.rows[0].total),
            cxc: parseFloat(resCxC.rows[0].total),
            stockAlerts: resStock.rows,
            chartVentas: resChartVentas.rows,
            chartCompras: resChartCompras.rows,
            recentOrders: resRecentOrders.rows,
            urgentPayments: resUrgent.rows,
            marketing: {
                inversion: gastoMkt,
                roi: gastoMkt > 0 ? (((totalVentas - gastoMkt) / gastoMkt) * 100) : 0,
                seguidores: metricas.nuevos_seguidores || 0,
                topCampana: metricas.top_campana ? `${metricas.top_campana} (${metricas.top_campana_metric})` : 'Calculando...'
            }
        };
    } catch (e) {
        console.error("❌ Error en Dashboard Model:", e.message);
        throw e;
    }
};