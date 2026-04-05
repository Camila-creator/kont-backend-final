// src/models/credit_notes.model.js
// Devoluciones / Notas de Crédito — revierte inventario, IMEI y genera PDF
const db    = require("../db");
const audit = require("../controllers/audit.controller");

// ─────────────────────────────────────────────────────────────────────
// LISTAR notas de crédito del tenant
// ─────────────────────────────────────────────────────────────────────
async function listCreditNotes(tenantId, filters = {}) {
  let where = "cn.tenant_id = $1";
  const vals = [tenantId];
  let c = 2;
  if (filters.status)      { where += ` AND cn.status = $${c++}`;      vals.push(filters.status); }
  if (filters.customer_id) { where += ` AND cn.customer_id = $${c++}`; vals.push(filters.customer_id); }

  const r = await db.query(
    `SELECT cn.id, cn.note_number, cn.type, cn.status, cn.total, cn.created_at,
            cn.customer_name_snapshot AS customer_name,
            cn.reason,
            o.order_number,
            COUNT(cni.id) AS items_count
     FROM credit_notes cn
     LEFT JOIN orders o ON o.id = cn.order_id
     LEFT JOIN credit_note_items cni ON cni.credit_note_id = cn.id
     WHERE ${where}
     GROUP BY cn.id, o.order_number
     ORDER BY cn.created_at DESC`,
    vals, tenantId
  );
  return r.rows;
}

// ─────────────────────────────────────────────────────────────────────
// OBTENER nota de crédito completa por ID
// ─────────────────────────────────────────────────────────────────────
async function getCreditNoteById(id, tenantId) {
  const cnR = await db.query(
    `SELECT cn.*, o.order_number, c.name AS customer_name_live, c.phone AS customer_phone,
            t.name AS tenant_name, t.rif AS tenant_rif, t.address AS tenant_address,
            t.phone AS tenant_phone, t.logo_url AS tenant_logo
     FROM credit_notes cn
     JOIN orders o ON o.id = cn.order_id
     LEFT JOIN customers c ON c.id = cn.customer_id
     JOIN tenants t ON t.id = cn.tenant_id
     WHERE cn.id = $1 AND cn.tenant_id = $2`,
    [id, tenantId], tenantId
  );
  if (!cnR.rows[0]) return null;

  const itemsR = await db.query(
    `SELECT cni.*, p.name AS product_name_live
     FROM credit_note_items cni
     JOIN products p ON p.id = cni.product_id
     WHERE cni.credit_note_id = $1 AND cni.tenant_id = $2 ORDER BY cni.id`,
    [id, tenantId], tenantId
  );

  return { ...cnR.rows[0], items: itemsR.rows };
}

// ─────────────────────────────────────────────────────────────────────
// CREAR nota de crédito (parcial o total)
// items: [{ order_item_id, product_id, qty, unit_price }]
// Si items está vacío → devolución total del pedido
// ─────────────────────────────────────────────────────────────────────
async function createCreditNote(data, tenantId, user) {
  const { order_id, reason, type = "TOTAL", notes, items: inputItems = [] } = data;

  if (!order_id || !reason?.trim()) {
    throw new Error("Pedido y motivo son obligatorios.");
  }

  // Verificar que el pedido existe y está CONFIRMADO
  const orderR = await db.query(
    `SELECT o.*, c.name AS customer_name
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1 AND o.tenant_id = $2`,
    [order_id, tenantId], tenantId
  );
  const order = orderR.rows[0];
  if (!order) throw new Error("Pedido no encontrado.");
  if (!["CONFIRMADO", "DESPACHADO", "ENTREGADO"].includes(order.status)) {
    throw new Error(`Solo se pueden devolver pedidos confirmados. Estado actual: ${order.status}.`);
  }

  // Verificar que no exista ya una nota total para este pedido
  if (type === "TOTAL") {
    const existR = await db.query(
      `SELECT id FROM credit_notes WHERE order_id=$1 AND tenant_id=$2 AND type='TOTAL' AND status!='ANULADA'`,
      [order_id, tenantId], tenantId
    );
    if (existR.rows.length > 0) throw new Error("Ya existe una nota de crédito total para este pedido.");
  }

  // Obtener items del pedido original
  const orderItemsR = await db.query(
    `SELECT oi.*, p.name AS product_name, p.retail_price
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1 AND oi.tenant_id = $2`,
    [order_id, tenantId], tenantId
  );
  const orderItems = orderItemsR.rows;

  // Determinar items a devolver
  let itemsToReturn;
  if (type === "TOTAL" || !inputItems.length) {
    // Devolución total: devolver todos los items
    itemsToReturn = orderItems.map(oi => ({
      order_item_id: oi.id,
      product_id:    oi.product_id,
      product_name:  oi.product_name,
      qty:           Number(oi.qty),
      unit_price:    Number(oi.unit_price),
      total:         Number(oi.total),
    }));
  } else {
    // Devolución parcial: validar cantidades
    itemsToReturn = inputItems.map(inp => {
      const orig = orderItems.find(oi => oi.product_id == inp.product_id);
      if (!orig) throw new Error(`Producto ID ${inp.product_id} no pertenece al pedido.`);
      if (Number(inp.qty) > Number(orig.qty)) {
        throw new Error(`No puedes devolver más de ${orig.qty} unidades de "${orig.product_name}".`);
      }
      return {
        order_item_id: orig.id,
        product_id:    orig.product_id,
        product_name:  orig.product_name,
        qty:           Number(inp.qty),
        unit_price:    Number(orig.unit_price),
        total:         Number(inp.qty) * Number(orig.unit_price),
      };
    });
  }

  const subtotal = itemsToReturn.reduce((s, it) => s + it.total, 0);

  // Número correlativo
  const year = new Date().getFullYear();
  const cntR = await db.query(
    `SELECT COUNT(*) FROM credit_notes WHERE tenant_id=$1 AND EXTRACT(YEAR FROM created_at)=$2`,
    [tenantId, year], tenantId
  );
  const seq = String(Number(cntR.rows[0].count) + 1).padStart(6, "0");
  const noteNumber = `NC-${year}-${seq}`;

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.current_tenant_id',$1,true)`, [tenantId.toString()]);

    // Insertar cabecera
    const cnR = await client.query(
      `INSERT INTO credit_notes
       (tenant_id, order_id, customer_id, note_number, reason, type,
        subtotal, total, customer_name_snapshot, tenant_name_snapshot, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [tenantId, order_id, order.customer_id, noteNumber, reason.trim(), type,
       subtotal, subtotal, order.customer_name, null, notes || null, user.id]
    );
    const cn = cnR.rows[0];

    // Insertar items
    for (const it of itemsToReturn) {
      await client.query(
        `INSERT INTO credit_note_items
         (tenant_id, credit_note_id, order_item_id, product_id, product_name_snapshot, qty, unit_price, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, cn.id, it.order_item_id, it.product_id, it.product_name, it.qty, it.unit_price, it.total]
      );
    }

    // ─── REVERTIR INVENTARIO ────────────────────────────────────────
    if (order.inventory_applied) {
      const config = await _getTenantConfig(tenantId, client);
      for (const it of itemsToReturn) {
        if (config.has_production) {
          // Empresa productora: devolver stock del producto terminado
          await client.query(
            `UPDATE products SET stock = stock + $1 WHERE id = $2 AND tenant_id = $3`,
            [it.qty, it.product_id, tenantId]
          );
        } else {
          // Verificar si tiene receta
          const recipeR = await client.query(
            `SELECT id FROM recipes WHERE product_id=$1 AND tenant_id=$2`,
            [it.product_id, tenantId]
          );
          if (recipeR.rows.length > 0) {
            // Devolver insumos consumidos
            const compsR = await client.query(
              `SELECT ri.supply_id, ri.qty AS comp_qty
               FROM recipe_items ri WHERE ri.recipe_id=$1 AND ri.tenant_id=$2`,
              [recipeR.rows[0].id, tenantId]
            );
            for (const comp of compsR.rows) {
              await client.query(
                `UPDATE supplies SET stock = stock + $1 WHERE id=$2 AND tenant_id=$3`,
                [Number(comp.comp_qty) * it.qty, comp.supply_id, tenantId]
              );
            }
          } else {
            // Producto simple: devolver al stock
            await client.query(
              `UPDATE products SET stock = stock + $1 WHERE id=$2 AND tenant_id=$3`,
              [it.qty, it.product_id, tenantId]
            );
          }
        }

        // Revertir IMEI si aplica
        await client.query(
          `UPDATE serial_numbers
           SET status='DISPONIBLE', order_id=NULL
           WHERE product_id=$1 AND order_id=$2 AND tenant_id=$3`,
          [it.product_id, order_id, tenantId]
        );
      }

      // Marcar inventario como revertido
      await client.query(
        `UPDATE credit_notes SET inventory_reversed=true WHERE id=$1`, [cn.id]
      );
    }

    await client.query("COMMIT");

    await audit.saveAuditLogInternal({
      tenant_id: tenantId, user_id: user.id, user_name: user.name,
      module: "DEVOLUCIONES", action: "CREATE_CREDIT_NOTE",
      description: `Nota de crédito ${noteNumber} emitida. Pedido #${order.order_number}. Total: $${subtotal.toFixed(2)}`,
    });

    return getCreditNoteById(cn.id, tenantId);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────
// ANULAR nota de crédito (solo si no se ha aplicado el inventario ya)
// ─────────────────────────────────────────────────────────────────────
async function cancelCreditNote(id, tenantId, user) {
  const cnR = await db.query(
    `SELECT * FROM credit_notes WHERE id=$1 AND tenant_id=$2`,
    [id, tenantId], tenantId
  );
  if (!cnR.rows[0]) throw new Error("Nota de crédito no encontrada.");
  if (cnR.rows[0].status === "ANULADA") throw new Error("La nota ya está anulada.");
  if (cnR.rows[0].inventory_reversed) {
    throw new Error("No se puede anular: el inventario ya fue revertido. Crea una nueva venta si necesitas revertir la devolución.");
  }

  const r = await db.query(
    `UPDATE credit_notes SET status='ANULADA' WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [id, tenantId], tenantId
  );

  await audit.saveAuditLogInternal({
    tenant_id: tenantId, user_id: user.id, user_name: user.name,
    module: "DEVOLUCIONES", action: "CANCEL_CREDIT_NOTE",
    description: `Nota de crédito ${cnR.rows[0].note_number} anulada.`,
  });

  return r.rows[0];
}

// ─────────────────────────────────────────────────────────────────────
// Helper interno: config del tenant (sin req)
// ─────────────────────────────────────────────────────────────────────
async function _getTenantConfig(tenantId, client) {
  const r = await client.query(
    `SELECT bc.has_imei, bc.has_production
     FROM tenants t
     LEFT JOIN business_categories bc ON t.category_id = bc.id
     WHERE t.id = $1`,
    [tenantId]
  );
  return r.rows[0] || { has_imei: false, has_production: false };
}

module.exports = { listCreditNotes, getCreditNoteById, createCreditNote, cancelCreditNote };