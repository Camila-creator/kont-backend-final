// src/models/accounts_receivable.model.js
const db = require("../db");

async function listARSummary(tenantId) {
  const q = `
    WITH order_totals AS (
      SELECT o.id, o.customer_id, COALESCE(SUM(oi.total), 0) AS total
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status = 'CONFIRMADO'
        AND o.tenant_id = $1
      GROUP BY o.id
    ),
    order_paid AS (
      SELECT cp.order_id, COALESCE(SUM(cp.amount), 0) AS paid
      FROM customer_payments cp
      WHERE cp.order_id IS NOT NULL AND cp.tenant_id = $1
      GROUP BY cp.order_id
    ),
    per_order AS (
      SELECT ot.id, ot.customer_id, ot.total,
             COALESCE(op.paid, 0) AS paid,
             GREATEST(ot.total - COALESCE(op.paid, 0), 0) AS pending
      FROM order_totals ot
      LEFT JOIN order_paid op ON op.order_id = ot.id
    )
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      COALESCE(SUM(po.total), 0) AS total_vendido,
      COALESCE(SUM(po.paid), 0) AS total_pagado,
      COALESCE(SUM(po.pending), 0) AS saldo,
      COALESCE(SUM(CASE WHEN po.pending > 0 THEN 1 ELSE 0 END), 0) AS pedidos_abiertos
    FROM customers c
    LEFT JOIN per_order po ON po.customer_id = c.id
    WHERE c.tenant_id = $1
    GROUP BY c.id, c.name
    HAVING COALESCE(SUM(po.total), 0) > 0
    ORDER BY saldo DESC, c.name ASC
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

module.exports = { listARSummary };
