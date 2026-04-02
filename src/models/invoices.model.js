// src/models/invoices.model.js
const db = require("../db");
const audit = require("../controllers/audit.controller");

// ─────────────────────────────────────────────────────────
// LISTAR facturas del tenant
// ─────────────────────────────────────────────────────────
async function listInvoices(tenantId) {
  const r = await db.query(
    `SELECT i.id, i.invoice_number, i.status, i.total, i.created_at,
            i.customer_name_snapshot AS customer_name,
            o.order_number
     FROM invoices i
     LEFT JOIN orders o ON o.id = i.order_id
     WHERE i.tenant_id = $1
     ORDER BY i.id DESC`,
    [tenantId], tenantId
  );
  return r.rows;
}

// ─────────────────────────────────────────────────────────
// OBTENER factura completa por ID (para renderizar el documento)
// ─────────────────────────────────────────────────────────
async function getInvoiceById(invoiceId, tenantId) {
  const invR = await db.query(
    `SELECT i.*,
            t.logo_url AS tenant_logo,
            t.instagram AS tenant_instagram
     FROM invoices i
     LEFT JOIN tenants t ON t.id = i.tenant_id
     WHERE i.id = $1 AND i.tenant_id = $2`,
    [invoiceId, tenantId], tenantId
  );
  if (!invR.rows[0]) return null;

  const invoice = invR.rows[0];

  const itemsR = await db.query(
    `SELECT * FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY id ASC`,
    [invoiceId, tenantId], tenantId
  );
  invoice.items = itemsR.rows;

  return invoice;
}

// ─────────────────────────────────────────────────────────
// CREAR factura desde pedido confirmado
// Mejoras: número FAC-YYYYNNNN, snapshot de logo, validación de estado
// ─────────────────────────────────────────────────────────
async function createInvoiceFromOrder(orderId, tenantId, user) {
  const order = await require("./orders.model").getOrderFullById(orderId, tenantId);
  if (!order) throw new Error("Pedido no encontrado.");
  if (order.status !== "CONFIRMADO") throw new Error("Solo se puede facturar pedidos CONFIRMADOS.");

  // Verificar que no exista ya una factura para este pedido
  const existing = await db.query(
    `SELECT id, invoice_number FROM invoices WHERE order_id = $1 AND tenant_id = $2`,
    [orderId, tenantId], tenantId
  );
  if (existing.rows.length > 0) {
    throw new Error(`Este pedido ya tiene una factura generada: ${existing.rows[0].invoice_number}`);
  }

  const tenantRes = await db.query(
    `SELECT * FROM tenants WHERE id = $1`,
    [tenantId], tenantId
  );
  const tenantData = tenantRes.rows[0];

  // Número correlativo legible: FAC-2026-000001
  const year = new Date().getFullYear();
  const countR = await db.query(
    `SELECT COUNT(*) FROM invoices WHERE tenant_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
    [tenantId, year], tenantId
  );
  const seq = String(Number(countR.rows[0].count) + 1).padStart(6, "0");
  const invNumber = `FAC-${year}-${seq}`;

  const subtotal = order.items.reduce((s, it) => s + Number(it.total), 0);
  const discount = Number(order.discount_amount || 0);
  const total = subtotal - discount;

  const invR = await db.query(
    `INSERT INTO invoices
     (tenant_id, order_id, customer_id, invoice_number,
      subtotal, discount_amount_snapshot, tax_amount, total,
      customer_name_snapshot, customer_rif_snapshot,
      tenant_name_snapshot, tenant_rif_snapshot,
      tenant_address_snapshot, tenant_phone_snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      tenantId, orderId, order.customer_id, invNumber,
      subtotal, discount, 0, total,
      order.customer?.name || order.customer_name,
      order.customer?.document || null,
      tenantData.name, tenantData.rif,
      tenantData.address, tenantData.phone,
    ],
    tenantId
  );

  const invoice = invR.rows[0];

  // Items con snapshot de nombre e IMEI
  for (const it of order.items) {
    // Buscar el IMEI asignado a este pedido para este producto
    const serialRes = await db.query(
      `SELECT imei FROM serial_numbers
       WHERE product_id = $1 AND tenant_id = $2 AND order_id = $3
       ORDER BY id DESC LIMIT 1`,
      [it.product_id, tenantId, orderId], tenantId
    );
    const imei = serialRes.rows[0]?.imei || null;

    await db.query(
      `INSERT INTO invoice_items
       (invoice_id, tenant_id, product_id, product_name_snapshot, qty, unit_price, total, imei_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [invoice.id, tenantId, it.product_id, it.product_name, it.qty, it.unit_price, it.total, imei],
      tenantId
    );
  }

  await audit.saveAuditLogInternal({
    tenant_id: tenantId, user_id: user.id, user_name: user.name,
    module: "FACTURACION", action: "CREATE",
    description: `Factura ${invNumber} generada. Pedido #${order.order_number}. Cliente: ${order.customer?.name || order.customer_name}`,
  });

  // Devolver la factura completa con items para renderizar inmediatamente
  return getInvoiceById(invoice.id, tenantId);
}

module.exports = { listInvoices, getInvoiceById, createInvoiceFromOrder };
