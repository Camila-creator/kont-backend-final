const db = require("../db");

/**
 * 1. LISTAR (Antes getActiveAlerts)
 */
const list = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const q = `
            SELECT * FROM alerts 
            WHERE tenant_id = $1 AND status = 'PENDING' 
            ORDER BY created_at DESC LIMIT 50
        `;
        const r = await db.query(q, [tenant_id]);
        res.json(r.rows); // Retornamos el array directo para que sea más fácil de mapear
    } catch (err) {
        res.status(500).json({ error: "Error al obtener alertas" });
    }
};

/**
 * 2. CONTEO (Para el badge de la campana)
 */
const getUnreadCount = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const q = `SELECT COUNT(*) as count FROM alerts WHERE tenant_id = $1 AND status = 'PENDING'`;
        const r = await db.query(q, [tenant_id]);
        res.json({ count: parseInt(r.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: "Error en el conteo" });
    }
};

/**
 * 3. RESOLVER (Antes resolveAlert)
 */
const resolve = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenant_id, id: user_id } = req.user;
        
        const q = `
            UPDATE alerts 
            SET status = 'RESOLVED', resolved_at = NOW(), resolved_by = $3
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `;
        const r = await db.query(q, [id, tenant_id, user_id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Alerta no encontrada" });
        
        res.json({ success: true, data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Error al resolver alerta" });
    }
};

/**
 * 4. MARCAR TODAS COMO LEÍDAS
 */
const markAllRead = async (req, res) => {
    try {
        const { tenant_id, id: user_id } = req.user;
        const q = `
            UPDATE alerts 
            SET status = 'RESOLVED', resolved_at = NOW(), resolved_by = $2
            WHERE tenant_id = $1 AND status = 'PENDING'
        `;
        await db.query(q, [tenant_id, user_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Error al marcar todas" });
    }
};

/**
 * 5. ELIMINAR
 */
const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenant_id } = req.user;
        await db.query("DELETE FROM alerts WHERE id = $1 AND tenant_id = $2", [id, tenant_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Error al eliminar" });
    }
};

/**
 * FUNCIÓN INTERNA: Crear alerta
 */
async function createAlertInternal({ tenant_id, tipo, titulo, mensaje, referencia_id, prioridad = 'MEDIA' }) {
    try {
        const check = await db.query(
            "SELECT id FROM alerts WHERE tenant_id=$1 AND tipo=$2 AND referencia_id=$3 AND status='PENDING'",
            [tenant_id, tipo, referencia_id]
        );
        if (check.rowCount > 0) return; 

        const q = `
            INSERT INTO alerts (tenant_id, tipo, titulo, mensaje, referencia_id, prioridad)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await db.query(q, [tenant_id, tipo, titulo, mensaje, referencia_id, prioridad]);
    } catch (err) {
        console.error("❌ Error creando alerta interna:", err);
    }
}

// Exportamos con los nombres que tu router espera:
module.exports = { 
    list, 
    getUnreadCount, 
    resolve, 
    markAllRead, 
    remove, 
    createAlertInternal 
};