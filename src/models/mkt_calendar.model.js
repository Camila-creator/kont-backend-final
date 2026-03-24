const db = require("../db");
const audit = require("../controllers/audit.controller");

async function getPosts(tenantId) {
    const q = "SELECT * FROM mkt_editorial_posts WHERE activo = true AND tenant_id = $1 ORDER BY fecha_publicacion ASC, hora_publicacion ASC";
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows;
}

async function createPost(data, tenantId, user) {
    const q = `INSERT INTO mkt_editorial_posts (tenant_id, titulo, plataforma, fecha_publicacion, hora_publicacion, estado, anuncio, copy_text, link_multimedia)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
    const v = [tenantId, data.titulo, data.plataforma, data.fecha, data.hora, data.estado, data.anuncio, data.copy, data.link];
    const r = await db.query(q, v, tenantId);
    const result = r.rows[0];

    if (result && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'CREATE_POST',
            description: `Post agendado: ${data.titulo} (${data.plataforma})`
        });
    }
    return result;
}

async function updatePost(id, data, tenantId, user) {
    const q = `UPDATE mkt_editorial_posts SET titulo=$1, plataforma=$2, fecha_publicacion=$3, hora_publicacion=$4, estado=$5, anuncio=$6, copy_text=$7, link_multimedia=$8 
               WHERE id = $9 AND tenant_id = $10 RETURNING *`;
    const v = [data.titulo, data.plataforma, data.fecha, data.hora, data.estado, data.anuncio, data.copy, data.link, id, tenantId];
    const r = await db.query(q, v, tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'UPDATE_POST',
            description: `Post actualizado: ${data.titulo}`
        });
    }
    return r.rows[0];
}

async function saveMetrics(data, tenantId, user) {
    const q = `INSERT INTO mkt_cm_metrics (tenant_id, periodo, seguidores, engagement, clics, pregunta_frecuente) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const v = [tenantId, data.periodo, data.seguidores, data.engagement, data.clics, data.pregunta];
    const r = await db.query(q, v, tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'SAVE_METRICS',
            description: `Métricas guardadas para el periodo: ${data.periodo}`
        });
    }
    return r.rows[0];
}

module.exports = { getPosts, createPost, updatePost, getLatestMetrics: (tid) => db.query("SELECT * FROM mkt_cm_metrics WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1", [tid], tid).then(r => r.rows[0]), saveMetrics };