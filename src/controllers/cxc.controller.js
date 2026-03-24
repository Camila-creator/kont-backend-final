const db = require("../db");

exports.summary = async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const qSearch = (req.query.q || "").toString().trim().toLowerCase();

  const q = `
    WITH order_totals AS (
      SELECT o.id AS order_id, o.customer_id, COALESCE(SUM(oi.total), 0) AS order_total
      FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status <> 'ANULADO' AND COALESCE(o.terms, 'CONTADO') = 'CREDITO' AND o.tenant_id = $2
      GROUP BY o.id, o.customer_id
    ),
    payments_by_order AS (
      SELECT cp.order_id, COALESCE(SUM(cp.amount), 0) AS paid_for_order
      FROM customer_payments cp WHERE cp.order_id IS NOT NULL AND cp.tenant_id = $2
      GROUP BY cp.order_id
    ),
    payments_by_customer_free AS (
      SELECT cp.customer_id, COALESCE(SUM(cp.amount), 0) AS paid_free
      FROM customer_payments cp WHERE cp.order_id IS NULL AND cp.tenant_id = $2
      GROUP BY cp.customer_id
    )
    SELECT
      c.id AS customer_id, c.name AS customer_name, COALESCE(SUM(ot.order_total), 0) AS total_sold,
      COALESCE(SUM(COALESCE(pbo.paid_for_order,0)), 0) + COALESCE(pbc.paid_free, 0) AS total_paid,
      COALESCE(SUM(ot.order_total), 0) - (COALESCE(SUM(COALESCE(pbo.paid_for_order,0)), 0) + COALESCE(pbc.paid_free, 0)) AS pending,
      COALESCE(SUM(CASE WHEN (ot.order_total - COALESCE(pbo.paid_for_order,0)) > 0 THEN 1 ELSE 0 END), 0) AS open_orders
    FROM customers c
    LEFT JOIN order_totals ot ON ot.customer_id = c.id
    LEFT JOIN payments_by_order pbo ON pbo.order_id = ot.order_id
    LEFT JOIN payments_by_customer_free pbc ON pbc.customer_id = c.id
    WHERE c.tenant_id = $2 AND ($1 = '' OR LOWER(c.name) LIKE '%' || $1 || '%')
    GROUP BY c.id, c.name, pbc.paid_free
    ORDER BY pending DESC, c.name ASC;
  `;
  const r = await db.query(q, [qSearch, tenantId], tenantId);
  res.json(r.rows);
};