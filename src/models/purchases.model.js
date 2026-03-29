const db = require("../db");
const audit = require("../controllers/audit.controller");
const alertController = require("../controllers/alert.controller");

/**
 * LISTAR COMPRAS (Añadido p.purchase_number)
 */
async function listPurchases(tenantId) {
  if (!tenantId) return [];
  const q = `
    SELECT 
        p.id, p.purchase_number, p.status, p.invoice_ref, p.purchase_date, p.condition, 
        p.due_date, p.inventory_applied, p.notes,
        p.currency_code, p.exchange_rate,
        s.nombre AS supplier_name,
        COALESCE(SUM(pi.total), 0) AS total,
        COUNT(pi.id) AS items_count
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
    WHERE p.tenant_id = $1
    GROUP BY p.id, p.purchase_number, s.nombre
    ORDER BY p.id DESC
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

/**
 * OBTENER CABECERA DE COMPRA
 */
async function getPurchaseHeaderById(id, tenantId) {
  const q = `
    SELECT 
        p.*, 
        s.nombre AS supplier_name,
        COALESCE((SELECT SUM(total) FROM purchase_items WHERE purchase_id = p.id), 0) AS total
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = $1 AND p.tenant_id = $2
  `;
  const r = await db.query(q, [id, tenantId], tenantId);
  return r.rows[0] || null;
}

/**
 * OBTENER ITEMS DE LA COMPRA
 */
async function getPurchaseItemsByPurchaseId(purchaseId, tenantId) {
  const q = `
    SELECT 
      pi.*, 
      pr.name AS product_name, 
      su.name AS supply_name,
      su.unit AS supply_unit
    FROM purchase_items pi
    LEFT JOIN products pr ON pr.id = pi.product_id
    LEFT JOIN supplies su ON su.id = pi.supply_id
    WHERE pi.purchase_id = $1
    ORDER BY pi.id ASC
  `;
  const r = await db.query(q, [purchaseId], tenantId); 
  return r.rows;
}

/**
 * CREAR COMPRA (Con generación de purchase_number y ALERTAS)
 */
async function createPurchaseWithItems(payload, user) {
  const { 
    tenant_id, supplier_id, status = "BORRADOR", invoice_ref = null, 
    notes = null, purchase_date = null, condition = "CONTADO", 
    due_date = null, items = [],
    currency_code = 'USD', exchange_rate = 1
  } = payload;
  
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenant_id.toString()]);

    const ins = `
      INSERT INTO purchases (
        tenant_id, supplier_id, status, invoice_ref, notes, 
        purchase_date, condition, due_date, inventory_applied,
        currency_code, exchange_rate, purchase_number
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), $7, $8, false, $9, $10,
        (SELECT COALESCE(MAX(purchase_number), 0) + 1 FROM purchases WHERE tenant_id = $1)
      )
      RETURNING id, purchase_number
    `;
    
    const r1 = await client.query(ins, [
      tenant_id, supplier_id, status, invoice_ref, notes, 
      purchase_date, condition, 
      condition === "CREDITO" ? due_date : null, 
      currency_code, exchange_rate
    ]);
    
    const purchaseId = r1.rows[0].id;
    const purchaseNum = r1.rows[0].purchase_number;

    if (items.length) {
      const insItem = `INSERT INTO purchase_items (purchase_id, product_id, supply_id, qty, unit_cost, total) VALUES ($1,$2,$3,$4,$5,$6)`;
      for (const it of items) {
        const qty = Number(it.qty || 0);
        const cost = Number(it.unit_cost || 0);
        await client.query(insItem, [purchaseId, it.product_id || null, it.supply_id || null, qty, cost, it.total || (qty * cost)]);
      }
    }

    // =========================================================
    // LÓGICA DE ALERTAS: Si la compra es a crédito, avisar del pago pendiente
    // =========================================================
    if (condition === "CREDITO") {
        await alertController.createAlertInternal({
            tenant_id,
            tipo: 'PAGO_PROVEEDOR',
            titulo: `📅 Pago Pendiente: Compra #${purchaseNum}`,
            mensaje: `Se registró una compra a crédito por pagar. Vence el: ${due_date || 'Fecha no definida'}.`,
            referencia_id: purchaseId,
            prioridad: 'MEDIA'
        });
    }

    await client.query("COMMIT");

    if (user) {
      await audit.saveAuditLogInternal({
        tenant_id, user_id: user.id, user_name: user.name,
        module: 'COMPRAS', action: 'CREATE_PURCHASE',
        description: `Se registró compra #${purchaseNum} del proveedor ID ${supplier_id}. ID Interno: ${purchaseId}`
      });
    }
    return { id: purchaseId, purchase_number: purchaseNum };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * ACTUALIZAR CABECERA BÁSICA (Con soporte para alertas si cambia a crédito)
 */
async function updatePurchaseBasic(id, patch, tenantId, user) {
  const q = `
    UPDATE purchases SET
      supplier_id = COALESCE($3, supplier_id), 
      status = COALESCE($4, status), 
      invoice_ref = COALESCE($5, invoice_ref),
      notes = COALESCE($6, notes), 
      purchase_date = COALESCE($7, purchase_date), 
      condition = COALESCE($8, condition),
      due_date = COALESCE($9, due_date), 
      currency_code = COALESCE($10, currency_code),
      exchange_rate = COALESCE($11, exchange_rate),
      updated_at = now()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `;
  
  const r = await db.query(q, [
    id, tenantId, patch.supplier_id ?? null, patch.status ?? null, 
    patch.invoice_ref ?? null, patch.notes ?? null, patch.purchase_date ?? null, 
    patch.condition ?? null, patch.due_date ?? null, patch.currency_code ?? null, 
    patch.exchange_rate ?? null
  ], tenantId);
  
  const result = r.rows[0];

  if (result) {
    // Si al actualizar, la condición cambió o se mantiene en CRÉDITO, renovamos/creamos la alerta
    if (result.condition === "CREDITO") {
        await alertController.createAlertInternal({
            tenant_id: tenantId,
            tipo: 'PAGO_PROVEEDOR',
            titulo: `📅 Pago Pendiente: Compra #${result.purchase_number || id}`,
            mensaje: `La compra está marcada como CRÉDITO. Vence el: ${result.due_date || 'Fecha no definida'}.`,
            referencia_id: result.id,
            prioridad: 'MEDIA'
        });
    }

    if (user) {
      await audit.saveAuditLogInternal({
        tenant_id: tenantId, user_id: user.id, user_name: user.name,
        module: 'COMPRAS', action: 'UPDATE_PURCHASE',
        description: `Actualizada cabecera de compra #${result.purchase_number || id}. Estado: ${result.status}`
      });
    }
  }
  return result;
}
/**
 * REEMPLAZAR ITEMS DE COMPRA
 */
async function replacePurchaseItems(id, items, tenantId, user) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId.toString()]);

    const check = await client.query(`SELECT id, purchase_number FROM purchases WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (check.rowCount === 0) throw new Error("Acceso denegado o compra no existe");
    const pNum = check.rows[0].purchase_number;

    await client.query(`DELETE FROM purchase_items WHERE purchase_id = $1`, [id]);
    
    const insItem = `INSERT INTO purchase_items (purchase_id, product_id, supply_id, qty, unit_cost, total) VALUES ($1,$2,$3,$4,$5,$6)`;
    for (const it of items) {
      const qty = Number(it.qty || 0);
      const cost = Number(it.unit_cost || 0);
      await client.query(insItem, [id, it.product_id || null, it.supply_id || null, qty, cost, it.total || (qty * cost)]);
    }
    
    await client.query("COMMIT");

    if (user) {
      await audit.saveAuditLogInternal({
        tenant_id: tenantId, user_id: user.id, user_name: user.name,
        module: 'COMPRAS', action: 'REPLACE_PURCHASE_ITEMS',
        description: `Se redefinieron los artículos de la compra #${pNum || id}.`
      });
    }
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { 
  listPurchases, getPurchaseHeaderById, getPurchaseItemsByPurchaseId, 
  createPurchaseWithItems, updatePurchaseBasic, replacePurchaseItems 
};