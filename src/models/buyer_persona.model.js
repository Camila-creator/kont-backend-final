const db = require("../db");
const audit = require("../controllers/audit.controller");

async function getAll(tenantId) {
    const q = "SELECT * FROM mkt_buyer_personas WHERE activo = true AND tenant_id = $1 ORDER BY id ASC";
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows;
}

async function create(data, tenantId, user) {
    const q = `INSERT INTO mkt_buyer_personas (tenant_id, nombre, descripcion, data_real, data_ideal) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const v = [tenantId, data.nombre, data.descripcion, data.data_real, data.data_ideal];
    const r = await db.query(q, v, tenantId);
    const persona = r.rows[0];

    if (persona && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId,
            user_id: user.id,
            user_name: user.name,
            module: 'MARKETING',
            action: 'CREATE_PERSONA',
            description: `Se creó el Buyer Persona: ${data.nombre}`
        });
    }
    return persona;
}

async function update(id, data, tenantId, user) {
    const q = `UPDATE mkt_buyer_personas SET nombre = $1, descripcion = $2, data_real = $3, data_ideal = $4 WHERE id = $5 AND tenant_id = $6 RETURNING *`;
    const v = [data.nombre, data.descripcion, data.data_real, data.data_ideal, id, tenantId];
    const r = await db.query(q, v, tenantId);
    const actualizado = r.rows[0];

    if (actualizado && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId,
            user_id: user.id,
            user_name: user.name,
            module: 'MARKETING',
            action: 'UPDATE_PERSONA',
            description: `Se actualizó el Buyer Persona: ${data.nombre}`
        });
    }
    return actualizado;
}

// 🚀 Exportación limpia sin autoreferencias circulares
module.exports = { getAll, create, update };