const db = require("../db");

async function listAPSummary(tenantId) {
  const q = `
    WITH purchase_totals AS (
      SELECT p.id, p.supplier_id, p.due_date, COALESCE(SUM(pi.total), 0) AS total
      FROM purchases p
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id 
      WHERE p.tenant_id = $1 
        AND p.condition = 'CREDITO' 
        AND COALESCE(p.status, 'BORRADOR') <> 'ANULADA'
      GROUP BY p.id
    ),
    purchase_paid AS (
      SELECT sp.purchase_id, COALESCE(SUM(sp.amount), 0) AS paid
      FROM supplier_payments sp
      WHERE sp.tenant_id = $1 AND sp.purchase_id IS NOT NULL
      GROUP BY sp.purchase_id
    ),
    per_purchase AS (
      SELECT pt.id, pt.supplier_id, pt.due_date, pt.total, COALESCE(pp.paid, 0) AS paid,
             GREATEST(pt.total - COALESCE(pp.paid, 0), 0) AS pending
      FROM purchase_totals pt
      LEFT JOIN purchase_paid pp ON pp.purchase_id = pt.id
    )
    SELECT
      s.id AS supplier_id, 
      s.nombre AS supplier_name, -- 🛡️ CORREGIDO: s.nombre en lugar de s.name
      COALESCE(SUM(pp.total), 0) AS total_compras,
      COALESCE(SUM(pp.paid), 0) AS total_pagado,
      COALESCE(SUM(pp.pending), 0) AS saldo,
      COALESCE(SUM(CASE WHEN pp.pending > 0 THEN 1 ELSE 0 END), 0) AS compras_abiertas,
      MIN(CASE WHEN pp.pending > 0 THEN pp.due_date ELSE NULL END) AS proximo_vencimiento
    FROM suppliers s
    LEFT JOIN per_purchase pp ON pp.supplier_id = s.id
    WHERE s.tenant_id = $1
    GROUP BY s.id, s.nombre -- 🛡️ CORREGIDO: s.nombre
    HAVING COALESCE(SUM(pp.total), 0) > 0
    ORDER BY saldo DESC, s.nombre ASC; -- 🛡️ CORREGIDO: s.nombre
  `;
  
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

module.exports = { listAPSummary };