const db = require("../db");
const audit = require("../controllers/audit.controller");

exports.listBanks = async (tenantId) => {
  const q = `SELECT * FROM finance_banks WHERE is_active = true AND tenant_id = $1 ORDER BY name ASC`;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
};

exports.createBank = async (data, user) => {
  const q = `
    INSERT INTO finance_banks (tenant_id, name, country_code, notes, is_active) 
    VALUES ($1, $2, $3, $4, true) 
    ON CONFLICT (tenant_id, name, country_code) 
    DO UPDATE SET 
        is_active = true, 
        notes = EXCLUDED.notes,
        updated_at = NOW()
    RETURNING *`;
    
  const r = await db.query(q, [
    data.tenant_id, 
    data.name.trim(), 
    data.country_code || 'VE', 
    data.notes || ''
  ], data.tenant_id);
  
  const nuevo = r.rows[0];
  if (nuevo && user) {
    await audit.saveAuditLogInternal({
      tenant_id: data.tenant_id,
      user_id: user.id,
      user_name: user.name,
      module: 'FINANZAS',
      action: 'CREATE_OR_REACTIVATE_BANK',
      description: `Banco gestionado: ${nuevo.name}`
    });
  }
  return nuevo;
};

exports.updateBank = async (id, data, tenantId, user) => {
  const q = `
    UPDATE finance_banks 
    SET name = COALESCE($1, name), 
        country_code = COALESCE($2, country_code), 
        notes = COALESCE($3, notes), 
        is_active = COALESCE($4, is_active),
        updated_at = NOW() 
    WHERE id = $5 AND tenant_id = $6 
    RETURNING *`;

  const r = await db.query(q, [data.name, data.country_code, data.notes, data.is_active, id, tenantId], tenantId);
  const actualizado = r.rows[0];

  if (actualizado && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: user.id,
      user_name: user.name,
      module: 'FINANZAS',
      action: 'UPDATE_BANK',
      description: `Modificó banco ID ${id}: ${actualizado.name}`
    });
  }
  return actualizado;
};

exports.deleteBank = async (id, tenantId, user) => {
  const q = `UPDATE finance_banks SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`;
  const r = await db.query(q, [id, tenantId], tenantId);
  const eliminado = r.rows[0];

  if (eliminado && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: user.id,
      user_name: user.name,
      module: 'FINANZAS',
      action: 'DELETE_BANK',
      description: `Desactivó banco: ${eliminado.name}`
    });
  }
  return eliminado;
};