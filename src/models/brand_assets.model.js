const db = require("../db");
const audit = require("../controllers/audit.controller");

async function listBrandAssets(tenantId) {
  const q = `
    SELECT id, tipo, nombre, valor, descripcion 
    FROM mkt_brand_assets 
    WHERE activo = true AND tenant_id = $1
    ORDER BY tipo, id ASC;
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

async function updateBrandAsset({ id, valor, descripcion }, tenantId, user) {
  const q = `
    UPDATE mkt_brand_assets 
    SET valor = $2, descripcion = $3, updated_at = NOW() 
    WHERE id = $1 AND tenant_id = $4
    RETURNING *;
  `;
  const r = await db.query(q, [Number(id), valor, descripcion, tenantId], tenantId);
  const actualizado = r.rows[0];

  if (actualizado && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: user.id,
      user_name: user.name,
      module: 'MARKETING',
      action: 'UPDATE_BRAND_ASSET',
      description: `Se actualizó el recurso: ${actualizado.nombre}`
    });
  }
  return actualizado;
}

module.exports = { listBrandAssets, updateBrandAsset };