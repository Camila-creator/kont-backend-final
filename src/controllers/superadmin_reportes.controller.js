// backend/controllers/superadmin_reportes.controller.js
const { pool } = require("../db");

exports.getUsageReports = async (req, res) => {
    try {
        // Solo la Súper Administradora (tú) puede ver esto
        if (req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Acceso denegado. Exclusivo para Súper Admin." });
        }

        // Hacemos subconsultas para saber exactamente el volumen de datos de cada empresa
        const q = `
            SELECT 
                t.id AS tenant_id,
                t.name AS empresa,
                t.is_active,
                (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id) AS total_pedidos,
                (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) AS total_clientes,
                (SELECT COUNT(*) FROM products WHERE tenant_id = t.id) AS total_productos,
                (SELECT COALESCE(SUM(amount), 0) FROM customer_payments WHERE tenant_id = t.id) AS volumen_dinero
            FROM tenants t
            ORDER BY total_pedidos DESC, volumen_dinero DESC;
        `;
        
        const { rows } = await pool.query(q);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error("Error en Reportes de Uso:", error);
        res.status(500).json({ error: "Error calculando reportes de uso" });
    }
};