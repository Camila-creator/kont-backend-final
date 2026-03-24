const db = require("../db");

/**
 * Crea un ítem de pedido con validación de Tenant y soporte para seriales (notes).
 */
async function createOrderItem({ order_id, product_id, qty, unit_price, tenant_id, serials }) {
  const total = Number(qty) * Number(unit_price);
  
  // 📱 Convertimos el array de seriales en un string para la columna 'notes'
  // Solo se hace si vienen seriales (lógica de telefonía)
  const notes = (serials && Array.isArray(serials) && serials.length > 0) 
    ? serials.join(", ") 
    : null;

  const q = `
    INSERT INTO order_items (order_id, product_id, qty, unit_price, total, tenant_id, notes) 
    VALUES ($1, $2, $3, $4, $5, $6, $7) 
    RETURNING *;
  `;
  
  // 🚀 IMPORTANTE: tenant_id como 3er parámetro para el RLS de db.js
  const r = await db.query(
    q, 
    [order_id, product_id, qty, unit_price, total, tenant_id, notes], 
    tenant_id
  );
  
  return r.rows[0];
}

/**
 * Borra ítems de un pedido asegurando que el pedido pertenezca al tenant.
 */
async function deleteItemsByOrderId(orderId, tenantId) {
  const q = `
    DELETE FROM order_items 
    WHERE order_id = $1 AND tenant_id = $2
  `;
  await db.query(q, [orderId, tenantId], tenantId);
}

module.exports = { createOrderItem, deleteItemsByOrderId };