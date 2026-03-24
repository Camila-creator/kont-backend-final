// backend/controllers/superadmin_soporte.controller.js
const { pool } = require("../db");

// 1. Obtener todos los tickets (Con opción de filtrar por estado)
exports.getTickets = async (req, res) => {
    try {
        if (req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Acceso denegado. Exclusivo para Súper Admin." });
        }

        const { status } = req.query;
        let q = `
            SELECT 
                t.id, 
                t.subject, 
                t.message, 
                t.priority, 
                t.status, 
                t.created_at,
                COALESCE(ten.name, 'Empresa Desconocida') AS empresa,
                COALESCE(u.name, 'Usuario Desconocido') AS usuario_nombre,
                COALESCE(u.email, 'Sin correo') AS usuario_email
            FROM support_tickets t
            LEFT JOIN tenants ten ON t.tenant_id = ten.id
            LEFT JOIN users u ON t.user_id = u.id
        `;
        
        const params = [];
        
        // Si hay un filtro desde el frontend que no sea "ALL", lo aplicamos
        if (status && status !== 'ALL') {
            q += ` WHERE t.status = $1`;
            params.push(status);
        }

        // Ordenamos: Primero los Pendientes, luego En Proceso, luego Resueltos. Y por fecha más reciente.
        q += ` ORDER BY 
                CASE WHEN t.status = 'PENDIENTE' THEN 1 
                     WHEN t.status = 'EN PROCESO' THEN 2 
                     ELSE 3 END,
                t.created_at DESC`;

        const { rows } = await pool.query(q, params);
        res.json({ data: rows });

    } catch (error) {
        console.error("Error obteniendo tickets:", error);
        res.status(500).json({ error: "Error al cargar los tickets de soporte." });
    }
};

// 2. Actualizar el estado de un ticket (Marcar como Resuelto/En proceso)
exports.updateTicketStatus = async (req, res) => {
    try {
        if (req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Acceso denegado." });
        }

        const ticketId = req.params.id;
        const { status } = req.body;

        if (!['PENDIENTE', 'EN PROCESO', 'RESUELTO'].includes(status)) {
            return res.status(400).json({ error: "Estado no válido." });
        }

        await pool.query(
            "UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2",
            [status, ticketId]
        );

        res.json({ message: "Estado del ticket actualizado exitosamente." });
    } catch (error) {
        console.error("Error actualizando ticket:", error);
        res.status(500).json({ error: "Error al actualizar el ticket." });
    }
}; 