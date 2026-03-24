const db = require("../db");
const audit = require("../controllers/audit.controller");

async function getAll(tenantId) {
    const q = "SELECT * FROM mkt_influencers WHERE tenant_id = $1 ORDER BY id DESC";
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows;
}

async function create(data, tenantId, user) {
    const q = `INSERT INTO mkt_influencers (tenant_id, nombre, handle, plataforma, nicho, seguidores, estatus, telefono, link_perfil, tipo_contrato, fecha_inicio, fecha_fin, cuota, modalidad_pago, inversion, num_pendientes, pendientes_texto, notas_resultados, leads, evaluacion)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`;
    const v = [tenantId, data.nombre, data.handle, data.plataforma, data.nicho, data.seguidores, data.estatus, data.telefono, data.link_perfil, data.tipo_contrato, data.fecha_inicio, data.fecha_fin, data.cuota, data.modalidad_pago, data.inversion, data.num_pendientes, data.pendientes_texto, data.notas_resultados, data.leads, data.evaluacion];
    const r = await db.query(q, v, tenantId);
    const result = r.rows[0];

    if (result && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'CREATE_INFLUENCER',
            description: `Se registró influencer: ${data.nombre} (@${data.handle})`
        });
    }
    return result;
}

async function update(id, data, tenantId, user) {
    const q = `UPDATE mkt_influencers SET nombre=$1, handle=$2, plataforma=$3, nicho=$4, seguidores=$5, estatus=$6, telefono=$7, link_perfil=$8, tipo_contrato=$9, fecha_inicio=$10, fecha_fin=$11, cuota=$12, modalidad_pago=$13, inversion=$14, num_pendientes=$15, pendientes_texto=$16, notas_resultados=$17, leads=$18, evaluacion=$19 
               WHERE id = $20 AND tenant_id = $21 RETURNING *`;
    const v = [data.nombre, data.handle, data.plataforma, data.nicho, data.seguidores, data.estatus, data.telefono, data.link_perfil, data.tipo_contrato, data.fecha_inicio, data.fecha_fin, data.cuota, data.modalidad_pago, data.inversion, data.num_pendientes, data.pendientes_texto, data.notas_resultados, data.leads, data.evaluacion, id, tenantId];
    const r = await db.query(q, v, tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'UPDATE_INFLUENCER',
            description: `Actualizado convenio con: ${data.nombre}`
        });
    }
    return r.rows[0];
}

module.exports = { getAll, create, update };