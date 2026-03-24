const db = require("../db");
const audit = require("../controllers/audit.controller");

async function listSupplierPayments(filters = {}) {
  const where = [];
  const values = [];
  let i = 1;

  where.push(`sp.tenant_id = $${i++}`);
  values.push(filters.tenant_id);

  if (filters.supplier_id) { 
    where.push(`sp.supplier_id = $${i++}`); 
    values.push(Number(filters.supplier_id)); 
  }
  if (filters.purchase_id) { 
    where.push(`sp.purchase_id = $${i++}`); 
    values.push(Number(filters.purchase_id)); 
  }

  const q = `
    SELECT sp.*, s.nombre AS supplier_name, fa.name AS finance_account_name
    FROM supplier_payments sp
    LEFT JOIN suppliers s ON s.id = sp.supplier_id
    LEFT JOIN finance_accounts fa ON fa.id = sp.finance_account_id
    WHERE ${where.join(" AND ")}
    ORDER BY sp.paid_at DESC, sp.id DESC
  `;

  const r = await db.query(q, values, filters.tenant_id);
  return r.rows;
}

async function sumPaidByPurchaseId(purchaseId, client, tenantId) {
  const r = await client.query(
    `SELECT COALESCE(SUM(amount),0) AS paid 
     FROM supplier_payments 
     WHERE purchase_id = $1 AND tenant_id = $2`, 
    [Number(purchaseId), tenantId]
  );
  return Number(r.rows[0]?.paid || 0);
}

async function createSupplierPaymentTx(client, payload, user) {
  const { 
    tenant_id, supplier_id, purchase_id = null, amount, 
    method, finance_account_id = null, ref = null, 
    paid_at = null, notes = null,
    exchange_rate = 1, currency_code = 'USD'
  } = payload;

  // HEMOS QUITADO EL COMENTARIO "//" DE AQUÍ ADENTRO:
  const q = `
    INSERT INTO supplier_payments (
      tenant_id, supplier_id, purchase_id, amount, method, 
      finance_account_id, ref, paid_at, notes,
      exchange_rate, currency_code
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()), $9, $10, $11)
    RETURNING *
  `;

  const r = await client.query(q, [
    tenant_id, 
    Number(supplier_id), 
    purchase_id ? Number(purchase_id) : null, 
    Number(amount), 
    (method || "").toString().trim().toUpperCase(), 
    finance_account_id ? Number(finance_account_id) : null, 
    ref, 
    paid_at, 
    notes,
    exchange_rate, 
    currency_code  
  ]);
  
  const payment = r.rows[0];

  if (payment && user) {
    await audit.saveAuditLogInternal({
      tenant_id, user_id: user.id, user_name: user.name,
      module: 'FINANZAS', action: 'SUPPLIER_PAYMENT',
      description: `Pago a proveedor ID ${supplier_id} por monto ${amount} (Tasa: ${exchange_rate}). Ref: ${ref}`
    });
  }

  return payment;
}

module.exports = { listSupplierPayments, sumPaidByPurchaseId, createSupplierPaymentTx };