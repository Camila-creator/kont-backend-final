const db = require("../db");
const audit = require("../controllers/audit.controller");
const finance = require("../utils/financeHelper");

/**
 * FUNCIÓN INTERNA: Obtiene la configuración del negocio (Flags)
 */
async function getTenantConfig(tenantId) {
  try {
    const q = `
      SELECT bc.has_imei, bc.has_production 
      FROM tenants t
      LEFT JOIN business_categories bc ON t.business_category_id = bc.id
      WHERE t.id = $1
    `;
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows[0] || { has_imei: false, has_production: false };
  } catch (error) {
    console.warn("⚠️ Error obteniendo configuración del negocio:", error.message);
    return { has_imei: false, has_production: false };
  }
}

/**
 * FUNCIÓN INTERNA: Aplica el descuento de inventario Inteligente
 */
async function applyInventoryDeduction(orderId, tenantId, config) {
  await db.query(
    `UPDATE orders SET inventory_applied = true WHERE id = $1 AND tenant_id = $2`, 
    [orderId, tenantId], 
    tenantId
  );

  const itemsR = await db.query(
    `SELECT product_id, qty FROM order_items WHERE order_id = $1 AND tenant_id = $2`, 
    [orderId, tenantId], 
    tenantId
  );

  for (const it of itemsR.rows) {
    if (config.has_production) {
      await db.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2 AND tenant_id = $3`, 
        [it.qty, it.product_id, tenantId], 
        tenantId
      );
    } else {
      try {
        const recipeR = await db.query(
          `SELECT * FROM recipes WHERE product_id = $1 AND tenant_id = $2`, 
          [it.product_id, tenantId], 
          tenantId
        );

        if (recipeR.rows.length > 0) {
          for (const component of recipeR.rows) {
            const supplyId = component.supply_id || component.insumo_id; 
            if (supplyId) {
              const totalToDeduct = component.qty * it.qty;
              await db.query(
                `UPDATE supplies SET stock = stock - $1 WHERE id = $2 AND tenant_id = $3`, 
                [totalToDeduct, supplyId, tenantId], 
                tenantId
              );
            }
          }
        } else {
          await db.query(
            `UPDATE products SET stock = stock - $1 WHERE id = $2 AND tenant_id = $3`, 
            [it.qty, it.product_id, tenantId], 
            tenantId
          );
        }
      } catch (err) {
        console.warn(`⚠️ Error inventario producto ${it.product_id}:`, err.message);
      }
    }
  }
}

/**
 * LISTAR PEDIDOS (Corregido con order_number)
 */
async function listOrders(tenantId) {
  const q = `
    SELECT o.id, o.order_number, o.customer_id, c.name AS customer_name, o.status, o.terms,
           o.price_mode, o.order_date, o.created_at, o.discount_amount, o.exchange_rate,
           COUNT(oi.id) AS items_count, 
           (COALESCE(SUM(oi.total), 0) - COALESCE(o.discount_amount, 0)) AS total
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.tenant_id = $1
    GROUP BY o.id, o.order_number, c.id, c.name
    ORDER BY o.created_at DESC;
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

/**
 * OBTENER PEDIDO COMPLETO (Corregido con order_number)
 */
async function getOrderFullById(id, tenantId) {
  const orderQ = `
    SELECT 
        o.*, c.name AS customer_name, c.doc AS customer_doc, 
        c.phone AS customer_phone, c.address AS customer_address,
        t.name AS tenant_name, t.rif AS tenant_rif, 
        t.address AS tenant_address, t.phone AS tenant_phone, 
        t.instagram AS tenant_instagram
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN tenants t ON t.id = o.tenant_id
    WHERE o.id = $1 AND o.tenant_id = $2
  `;
  
  try {
    const orderR = await db.query(orderQ, [id, tenantId], tenantId);
    if (!orderR.rows[0]) return null;

    const row = orderR.rows[0];
    const order = {
      ...row,
      customer: { name: row.customer_name, document: row.customer_doc, phone: row.customer_phone, address: row.customer_address },
      tenant: { name: row.tenant_name, rif: row.tenant_rif, address: row.tenant_address, phone: row.tenant_phone, instagram: row.tenant_instagram }
    };

    const itemsQ = `SELECT oi.*, p.name AS product_name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 AND oi.tenant_id = $2`;
    const itemsR = await db.query(itemsQ, [id, tenantId], tenantId);
    order.items = itemsR.rows;

    const paymentsQ = `
      SELECT p.*, COALESCE(fa.name, 'Cuenta no encontrada') AS account_name
      FROM customer_payments p
      LEFT JOIN finance_accounts fa ON fa.id = p.finance_account_id
      WHERE p.order_id = $1 AND p.tenant_id = $2
      ORDER BY p.paid_at DESC
    `;
    const paymentsR = await db.query(paymentsQ, [id, tenantId], tenantId);
    order.payments = paymentsR.rows;
    
    const subtotal = order.items.reduce((acc, it) => acc + parseFloat(it.total || 0), 0);
    order.subtotal = subtotal;
    order.discount_amount = parseFloat(row.discount_amount || 0);
    order.total = subtotal - order.discount_amount;
    
    return order;
  } catch (error) {
    console.error("Error en getOrderFullById:", error.message);
    throw error;
  }
}

/**
 * CREAR PEDIDO (Corregido con order_number automático)
 */
async function createOrder(data, tenantId, user) {
  const { 
    customer_id, status, terms, price_mode, 
    wholesale_threshold, notes, order_date, 
    items, payments, discount_amount, exchange_rate 
  } = data;
  
  const config = await getTenantConfig(tenantId);
  const finalStatus = (status || "BORRADOR").toUpperCase();

  // CAMBIO CLAVE: Insertamos el order_number calculando el máximo del tenant
  const orderQ = `
    INSERT INTO orders (
      tenant_id, customer_id, status, terms, price_mode, 
      wholesale_threshold, notes, order_date, discount_amount, 
      exchange_rate, order_number
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), $9, $10,
      (SELECT COALESCE(MAX(order_number), 0) + 1 FROM orders WHERE tenant_id = $1)
    ) 
    RETURNING *`;
  
  const orderR = await db.query(orderQ, [
    tenantId, customer_id, finalStatus, terms, (price_mode || "RETAIL").toUpperCase(), 
    Number(wholesale_threshold || 6), notes, order_date || null,
    Number(discount_amount || 0), Number(exchange_rate || 1) 
  ], tenantId);
  
  const order = orderR.rows[0];

  // Items y Seriales
  for (const it of items || []) {
    const qty = Number(it.qty || 0);
    const unit = Number(it.unit_price || 0);
    
    await db.query(
      `INSERT INTO order_items (order_id, product_id, qty, unit_price, total, tenant_id) VALUES ($1, $2, $3, $4, $5, $6)`, 
      [order.id, it.product_id, qty, unit, qty * unit, tenantId], tenantId
    );

    if (config.has_imei && it.serials && Array.isArray(it.serials) && it.serials.length > 0) {
      for (const imei of it.serials) {
        const cleanImei = imei.toUpperCase().trim();
        try {
          await db.query(
            `UPDATE serial_numbers SET status = 'VENDIDO' WHERE imei = $1 AND tenant_id = $2`,
            [cleanImei, tenantId], tenantId
          );
          await db.query(
            `UPDATE supply_serials SET status = 'USADO' WHERE serial_number = $1 AND tenant_id = $2`,
            [cleanImei, tenantId], tenantId
          ).catch(() => {});
        } catch (serialErr) {
          console.warn(`⚠️ Error serial ${cleanImei}:`, serialErr.message);
        }
      }
    }
  }

  // Pagos y Equipos Recibidos
  for (const p of payments || []) {
    if (p.method === 'EQUIPO_USADO') {
      await db.query(
        `INSERT INTO received_phones (tenant_id, order_id, model_description, credit_amount, user_id, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', NOW())`,
        [tenantId, order.id, p.phone_model, p.amount, user.id], tenantId
      );
    }
    
    await db.query(
      `INSERT INTO customer_payments (tenant_id, customer_id, order_id, amount, method, finance_account_id, ref, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [tenantId, customer_id, order.id, p.amount, p.method, p.finance_account_id, p.ref], tenantId
    );
  }

  if (finalStatus === "CONFIRMADO") {
    await applyInventoryDeduction(order.id, tenantId, config);
  }

  if (order && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId, user_id: user.id, user_name: user.name,
      module: 'VENTAS', action: 'CREATE_ORDER',
      description: `Pedido #${order.order_number} creado. ID Interno: ${order.id}`
    });
  }

  return order;
}

/**
 * ACTUALIZAR PEDIDO
 */
async function updateOrder(id, data, tenantId, user) {
  const { status, notes, terms, discount_amount, exchange_rate } = data;
  
  const prevR = await db.query("SELECT * FROM orders WHERE id=$1 AND tenant_id=$2", [id, tenantId], tenantId);
  if (!prevR.rows.length) return null;
  const order = prevR.rows[0];

  const nextStatus = (status || order.status).toUpperCase();
  
  await db.query(
    `UPDATE orders SET status=$1, notes=$2, terms=$3, discount_amount=$4, exchange_rate=$5, updated_at=now() WHERE id=$6 AND tenant_id=$7`, 
    [nextStatus, notes ?? order.notes, terms ?? order.terms, discount_amount ?? order.discount_amount, exchange_rate ?? order.exchange_rate, id, tenantId], tenantId
  );

  if (order.status !== "CONFIRMADO" && nextStatus === "CONFIRMADO" && !order.inventory_applied) {
    const config = await getTenantConfig(tenantId);
    await applyInventoryDeduction(id, tenantId, config);
  }

  return await getOrderFullById(id, tenantId);
}

/**
 * REGISTRAR PAGO A PEDIDO EXISTENTE
 */
async function addPaymentToOrder(data, tenantId) {
  const { order_id, customer_id, amount, method, finance_account_id, ref, paid_at } = data;
  const q = `
    INSERT INTO customer_payments (tenant_id, customer_id, order_id, amount, method, finance_account_id, ref, paid_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
    RETURNING *`;
  
  const r = await db.query(q, [tenantId, customer_id, order_id, amount, method, finance_account_id, ref, paid_at], tenantId);
  return r.rows[0];
}

module.exports = { listOrders, getOrderFullById, createOrder, updateOrder, addPaymentToOrder };