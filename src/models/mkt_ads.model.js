const db = require("../db");
const audit = require("../controllers/audit.controller");

// --- AUDIENCIAS ---
async function getAudiences(tenantId) {
    const q = "SELECT * FROM mkt_ads_audiences WHERE activo = true AND tenant_id = $1 ORDER BY id DESC";
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows;
}

async function createAudience(data, tenantId, user) {
    const q = `INSERT INTO mkt_ads_audiences (tenant_id, nombre, edad, genero, ubicacion, intereses) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const v = [tenantId, data.nombre, data.edad, data.genero, data.ubicacion, data.intereses];
    const r = await db.query(q, v, tenantId);
    const result = r.rows[0];

    if (result && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'CREATE_AUDIENCE',
            description: `Se creó audiencia: ${data.nombre}`
        });
    }
    return result;
}

async function deleteAudience(id, tenantId, user) {
    const q = "UPDATE mkt_ads_audiences SET activo = false WHERE id = $1 AND tenant_id = $2 RETURNING *";
    const r = await db.query(q, [id, tenantId], tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'DELETE_AUDIENCE',
            description: `Se desactivó audiencia ID: ${id}`
        });
    }
    return r.rows[0];
}

// --- CAMPAÑAS ---
async function getCampaigns(tenantId) {
    const q = "SELECT * FROM mkt_ads_campaigns WHERE tenant_id = $1 ORDER BY id DESC";
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows;
}

async function createCampaign(data, tenantId, user) {
    const q = `INSERT INTO mkt_ads_campaigns (tenant_id, post_id, nombre_campana, plataforma_origen, ubicacion_red, publico_edad, publico_genero, publico_ubicacion, publico_intereses, presupuesto_diario, fecha_inicio, fecha_fin, es_continuo, estado)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`;
    const v = [tenantId, data.post_id || null, data.nombre_campana, data.plataforma_origen, data.ubicacion_red, data.publico_edad, data.publico_genero, data.publico_ubicacion, data.publico_intereses, data.presupuesto_diario, data.fecha_inicio, data.fecha_fin || null, data.es_continuo, data.estado || 'Activa'];
    const r = await db.query(q, v, tenantId);
    const result = r.rows[0];

    if (result && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'CREATE_ADS_CAMPAIGN',
            description: `Nueva campaña: ${data.nombre_campana} en ${data.plataforma_origen}`
        });
    }
    return result;
}

async function updateCampaign(id, data, tenantId, user) {
    const q = `UPDATE mkt_ads_campaigns SET nombre_campana=$1, plataforma_origen=$2, ubicacion_red=$3, publico_edad=$4, publico_genero=$5, publico_ubicacion=$6, publico_intereses=$7, presupuesto_diario=$8, fecha_inicio=$9, fecha_fin=$10, es_continuo=$11, estado=$12, resultados=$13, eval_manual=$14, eval_sistema=$15 
               WHERE id = $16 AND tenant_id = $17 RETURNING *`;
    const v = [data.nombre_campana, data.plataforma_origen, data.ubicacion_red, data.publico_edad, data.publico_genero, data.publico_ubicacion, data.publico_intereses, data.presupuesto_diario, data.fecha_inicio, data.fecha_fin || null, data.es_continuo, data.estado, data.resultados, data.eval_manual, data.eval_sistema, id, tenantId];
    const r = await db.query(q, v, tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'UPDATE_ADS_CAMPAIGN',
            description: `Actualizada campaña: ${data.nombre_campana}`
        });
    }
    return r.rows[0];
}

module.exports = { getAudiences, createAudience, deleteAudience, getCampaigns, createCampaign, updateCampaign };