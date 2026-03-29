const db = require("../db");

/**
 * Obtener alertas activas para el Header
 */
const getActiveAlerts = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const q = `
            SELECT * FROM alerts 
            WHERE tenant_id = $1 AND status = 'PENDING' 
            ORDER BY created_at DESC LIMIT 20
        `;
        const r = await db.query(q, [tenant_id]);
        res.json({ data: r.rows });
    } catch (err) {
        res.status(500).json({ error: "Error al obtener alertas" });
    }
};

/**
 * Marcar alerta como resuelta
 */
const resolveAlert = async (req, res) => {
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
        res.json({ success: true, data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Error al resolver alerta" });
    }
};

/**
 * FUNCIÓN INTERNA: Crear alerta (Se llama desde otros modelos)
 * No es un endpoint, es para uso del servidor.
 */
async function createAlertInternal({ tenant_id, tipo, titulo, mensaje, referencia_id, prioridad = 'MEDIA' }) {
    try {
        // Evitar duplicados: Si ya existe una alerta PENDING del mismo tipo y referencia, no crear otra
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

module.exports = { getActiveAlerts, resolveAlert, createAlertInternal };