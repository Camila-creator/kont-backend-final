const db = require("../db");
const audit = require("../controllers/audit.controller");

async function getAllActivities(tenantId) {
    // 🛡️ Corregido: Filtro tenant_id añadido
    const q = "SELECT * FROM mkt_offline_activities WHERE tenant_id = $1 ORDER BY fecha_inicio DESC";
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows;
}

async function createActivity(data, tenantId, user) {
    const q = `INSERT INTO mkt_offline_activities (tenant_id, nombre, categoria, estado, ubicacion, fecha_inicio, fecha_fin, objetivo, presupuesto, gasto_real, resultados, proveedor, contacto, drive_link, notas)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`;
    const v = [tenantId, data.nombre, data.categoria, data.estado, data.ubicacion, data.fecha_inicio, data.fecha_fin || null, data.objetivo, data.presupuesto || 0, data.gasto_real || 0, data.resultados, data.proveedor, data.contacto, data.drive_link, data.notas];
    const r = await db.query(q, v, tenantId);
    const result = r.rows[0];

    if (result && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'CREATE_OFFLINE_ACTIVITY',
            description: `Nueva actividad offline: ${data.nombre} (${data.categoria})`
        });
    }
    return result;
}

async function updateActivity(id, data, tenantId, user) {
    // 🛡️ Corregido: Filtro tenant_id añadido en WHERE
    const q = `UPDATE mkt_offline_activities SET nombre=$1, categoria=$2, estado=$3, ubicacion=$4, fecha_inicio=$5, fecha_fin=$6, objetivo=$7, presupuesto=$8, gasto_real=$9, resultados=$10, proveedor=$11, contacto=$12, drive_link=$13, notas=$14 
               WHERE id = $15 AND tenant_id = $16 RETURNING *`;
    const v = [data.nombre, data.categoria, data.estado, data.ubicacion, data.fecha_inicio, data.fecha_fin || null, data.objetivo, data.presupuesto || 0, data.gasto_real || 0, data.resultados, data.proveedor, data.contacto, data.drive_link, data.notas, id, tenantId];
    const r = await db.query(q, v, tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'UPDATE_OFFLINE_ACTIVITY',
            description: `Actualizada actividad: ${data.nombre}`
        });
    }
    return r.rows[0];
}

module.exports = { getAllActivities, createActivity, updateActivity };