const db = require("../db");
const audit = require("../controllers/audit.controller"); // <--- Importado

function normType(v) { 
    const t = (v || "").toString().trim().toUpperCase(); 
    if (["BANCO", "EFECTIVO", "ZELLE", "CUENTA_EXTRANJERA","INTERCAMBIO"].includes(t)) return t; 
    return null; 
}

function normCurrency(v) { 
    const c = (v || "").toString().trim().toUpperCase(); 
    if (/^[A-Z]{3,5}$/.test(c)) return c; 
    return "USD"; 
}

exports.listAccounts = async (tenantId) => {
  const q = `
    SELECT 
        a.id, a.type, a.bank_id, b.name AS bank_name, b.country_code AS bank_country_code,
        a.name, a.currency, a.account_ref, a.holder_name, a.notes, a.is_active, a.created_at, a.updated_at,
        (
          COALESCE((SELECT SUM(amount) FROM customer_payments WHERE finance_account_id = a.id AND tenant_id = $1), 0) -
          COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE finance_account_id = a.id AND tenant_id = $1), 0)
        ) AS balance
    FROM finance_accounts a
    LEFT JOIN finance_banks b ON b.id = a.bank_id
    WHERE a.tenant_id = $1
    ORDER BY a.is_active DESC, a.type ASC, a.id DESC;
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
};

exports.createAccount = async (payload, user) => { // <--- Recibe user
  const type = normType(payload.type); 
  if (!type) throw new Error("type inválido");
  const bankId = payload.bank_id != null && payload.bank_id !== "" ? Number(payload.bank_id) : null;
  
  const q = `INSERT INTO finance_accounts (tenant_id, type, bank_id, name, currency, account_ref, holder_name, notes) 
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) 
             RETURNING *;`;
  
  const r = await db.query(q, [
    payload.tenant_id, 
    type, 
    bankId, 
    (payload.name || "").toString().trim(), 
    normCurrency(payload.currency), 
    payload.account_ref ? payload.account_ref.toString().trim() : null, 
    payload.holder_name ? payload.holder_name.toString().trim() : null, 
    payload.notes ? payload.notes.toString().trim() : null
  ], payload.tenant_id);

  const nueva = r.rows[0];

  // AUDITORÍA
  if (nueva && user) {
    await audit.saveAuditLogInternal({
      tenant_id: payload.tenant_id,
      user_id: user.id,
      user_name: user.name,
      module: 'FINANZAS',
      action: 'CREATE_ACCOUNT',
      description: `Creó la cuenta: ${nueva.name} (${nueva.type})`
    });
  }
  return nueva;
};

exports.updateAccount = async (id, payload, tenantId, user) => { // <--- Recibe user
  const type = payload.type != null ? normType(payload.type) : null; 
  const bankId = payload.bank_id != null ? (payload.bank_id === "" ? null : Number(payload.bank_id)) : null;
  
  const q = `
    UPDATE finance_accounts 
    SET type = COALESCE($2, type), 
        bank_id = COALESCE($3, bank_id), 
        name = COALESCE($4, name), 
        currency = COALESCE($5, currency), 
        account_ref = COALESCE($6, account_ref), 
        holder_name = COALESCE($7, holder_name), 
        notes = COALESCE($8, notes), 
        is_active = COALESCE($9, is_active), 
        updated_at = NOW() 
    WHERE id = $1 AND tenant_id = $10 
    RETURNING *;`;
  
  const r = await db.query(q, [
    Number(id), type, bankId, 
    payload.name != null ? payload.name.toString().trim() : null, 
    payload.currency != null ? normCurrency(payload.currency) : null, 
    payload.account_ref != null ? payload.account_ref.toString().trim() : null, 
    payload.holder_name != null ? payload.holder_name.toString().trim() : null, 
    payload.notes != null ? payload.notes.toString().trim() : null, 
    payload.is_active != null ? Boolean(payload.is_active) : null,
    tenantId
  ], tenantId);

  const actualizada = r.rows[0];

  // AUDITORÍA
  if (actualizada && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: user.id,
      user_name: user.name,
      module: 'FINANZAS',
      action: 'UPDATE_ACCOUNT',
      description: `Actualizó cuenta ID ${id}: ${actualizada.name}`
    });
  }
  return actualizada;
};

exports.deleteAccount = async (id, tenantId, user) => { // <--- Recibe user
  const q = `UPDATE finance_accounts SET is_active=false, updated_at=NOW() WHERE id=$1 AND tenant_id = $2 RETURNING *;`;
  const r = await db.query(q, [Number(id), tenantId], tenantId);
  const eliminada = r.rows[0];

  // AUDITORÍA
  if (eliminada && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: user.id,
      user_name: user.name,
      module: 'FINANZAS',
      action: 'DELETE_ACCOUNT',
      description: `Desactivó la cuenta: ${eliminada.name}`
    });
  }
  return eliminada;
};