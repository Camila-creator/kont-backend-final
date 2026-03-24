// backend/controllers/superadmin_dashboard.controller.js
const { pool } = require("../db");

exports.getMetrics = async (req, res) => {
    try {
        // 1. KPIs con tus nombres de columna reales
        const kpiTenants = await pool.query(`SELECT COUNT(*) FROM tenants`);
        const kpiUsers = await pool.query(`SELECT COUNT(*) FROM users`);
        const kpiTickets = await pool.query(`SELECT COUNT(*) FROM support_tickets WHERE status = 'PENDIENTE'`);
        
        const kpiExpiring = await pool.query(`
            SELECT COUNT(*) FROM tenants 
            WHERE next_payment_date <= CURRENT_DATE + INTERVAL '30 days' 
            AND next_payment_date >= CURRENT_DATE
        `);

        // 2. Rankings y Alertas (Igual que antes, pero dentro de este controlador)
        // ... (resto del código de las consultas que te pasé arriba)

        res.json({
            data: {
                stats: {
                    total_tenants: parseInt(kpiTenants.rows[0].count),
                    total_users: parseInt(kpiUsers.rows[0].count),
                    pending_tickets: parseInt(kpiTickets.rows[0].count),
                    expiring_soon: parseInt(kpiExpiring.rows[0].count)
                },
                // ... (alerts, top_tenants, etc.)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el dashboard" });
    }
};