const db = require("../db");
const audit = require("../controllers/audit.controller");

function normMethod(v) { return (v || "").toString().trim().toUpperCase(); }

exports.listRouting = async (tenantId) => {
  const q = `
    SELECT m.method, r.account_id, a.name AS account_name, a.type AS account_type,
           a.currency AS account_currency, b.name AS bank_name, b.country_code AS bank_country_code,
           COALESCE(r.is_active, true) AS is_active, r.updated_at
    FROM (
      VALUES ('PAGO_MOVIL'), ('TRANSFERENCIA'), ('EFECTIVO'), ('ZELLE'), ('CUENTA_EXTRANJERA')
    ) AS m(method)
    LEFT JOIN finance_method_routing r ON r.method = m.method AND r.tenant_id = $1
    LEFT JOIN finance_accounts a ON a.id = r.account_id AND a.tenant_id = $1
    LEFT JOIN finance_banks b ON b.id = a.bank_id AND b.tenant_id = $1
    ORDER BY m.method ASC;
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
};

exports.setRouting = async (method, account_id, tenantId, user) => {
  const m = normMethod(method);
  const accId = (account_id != null && account_id !== "") ? Number(account_id) : null;

  const q = `
    INSERT INTO finance_method_routing (tenant_id, method, account_id, is_active, updated_at)
    VALUES ($3, $1, $2, true, NOW())
    ON CONFLICT (method, tenant_id) 
    DO UPDATE SET 
      account_id = EXCLUDED.account_id, 
      updated_at = NOW()
    RETURNING *;
  `;
  
  const r = await db.query(q, [m, accId, tenantId], tenantId);
  const r_data = r.rows[0];

  if (r_data && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: user.id,
      user_name: user.name,
      module: 'FINANZAS',
      action: 'SET_ROUTING',
      description: `Se asignó el método ${m} a la cuenta ID ${accId}`
    });
  }
  return r_data;
};

// Estas funciones de consulta se mantienen iguales (solo lectura)
exports.getDefaultAccountIdByMethod = async (method, client = db, tenantId) => {
  const m = normMethod(method); if (!m) return null;
  const r = await client.query(
    `SELECT account_id FROM finance_method_routing 
     WHERE method = $1 AND is_active = true AND tenant_id = $2 LIMIT 1`, 
    [m, tenantId],
    tenantId
  );
  const out = r.rows[0]?.account_id; 
  return out == null ? null : Number(out);
};