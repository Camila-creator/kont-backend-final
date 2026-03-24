// backend/controllers/superadmin_usuarios_globales.controller.js
const { pool } = require("../db");

// 1. Traer todas las empresas con su contador de usuarios
exports.getTenantsSummary = async (req, res) => {
    try {
        // Validación de Súper Admin directo en el controlador
        if (req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Acceso denegado. Se requiere nivel de Súper Administrador." });
        }

        const q = `
            SELECT 
                t.id AS tenant_id, 
                t.name AS empresa, 
                t.is_active,
                t.created_at,
                COUNT(u.id) AS total_usuarios,
                SUM(CASE WHEN u.is_active = true THEN 1 ELSE 0 END) AS usuarios_activos
            FROM tenants t
            LEFT JOIN users u ON t.id = u.tenant_id
            GROUP BY t.id, t.name, t.is_active, t.created_at
            ORDER BY t.id ASC;
        `;
        const { rows } = await pool.query(q);
        res.json({ data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error cargando resumen de empresas" });
    }
};

// 2. Traer el historial de usuarios de UNA empresa en específico (El Espía)
exports.getTenantUsers = async (req, res) => {
    try {
        if (req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Acceso denegado." });
        }

        const tenantId = Number(req.params.id);
        if (!tenantId) return res.status(400).json({ error: "ID inválido" });

        const q = `
            SELECT id, name, email, role, is_active, created_at
            FROM users 
            WHERE tenant_id = $1 
            ORDER BY created_at DESC;
        `;
        const { rows } = await pool.query(q, [tenantId]);
        res.json({ data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error cargando usuarios del cliente" });
    }
};