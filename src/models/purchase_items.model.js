const db = require("../db");
const audit = require("../controllers/audit.controller");

/**
 * Aplica o revierte el inventario basado en los items de una compra.
 */
async function applyInventoryFromPurchase(purchaseId, deltaSign = +1, tenantId, user) {
  const client = await db.pool.connect();
  
  try {
    await client.query("BEGIN");
    // 🛡️ Blindaje de sesión para el Tenant
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId.toString()]);

    // 1. Verificamos existencia y bloqueamos fila (FOR UPDATE)
    const hdr = await client.query(
      `SELECT id, status FROM purchases WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [purchaseId, tenantId]
    );
    
    if (!hdr.rows[0]) throw new Error("Compra no encontrada o sin permisos.");

    // 2. Obtenemos artículos
    const itemsResult = await client.query(
      `SELECT product_id, supply_id, qty FROM purchase_items WHERE purchase_id = $1`, 
      [purchaseId]
    );
    const items = itemsResult.rows;

    // 3. Actualización masiva de Stock
    for (const it of items) {
      const qty = Number(it.qty || 0) * deltaSign;
      
      if (it.product_id) {
        await client.query(
          `UPDATE products SET stock = COALESCE(stock, 0) + $3, updated_at = now() 
           WHERE id = $1 AND tenant_id = $2`,
          [it.product_id, tenantId, qty]
        );
      } else if (it.supply_id) {
        await client.query(
          `UPDATE supplies SET stock = COALESCE(stock, 0) + $3, updated_at = now() 
           WHERE id = $1 AND tenant_id = $2`,
          [it.supply_id, tenantId, qty]
        );
      }
    }

    await client.query("COMMIT");

    // 📝 Auditoría: Registrar el movimiento de stock
    if (user) {
      const accion = deltaSign > 0 ? 'INGRESO_STOCK' : 'REVERSA_STOCK';
      await audit.saveAuditLogInternal({
        tenant_id: tenantId,
        user_id: user.id,
        user_name: user.name,
        module: 'INVENTARIO',
        action: accion,
        description: `${accion === 'INGRESO_STOCK' ? 'Aumento' : 'Reducción'} de stock por Compra #${purchaseId}`
      });
    }

    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ ERROR EN INVENTARIO:", e.message);
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Marca una compra como "procesada" en inventario.
 */
async function setInventoryApplied(purchaseId, value, tenantId) {
  const q = `
    UPDATE purchases 
    SET inventory_applied = $2, updated_at = now() 
    WHERE id = $1 AND tenant_id = $3 
    RETURNING id
  `;
  const r = await db.query(q, [purchaseId, !!value, tenantId], tenantId);
  return r.rows[0] || null;
}

module.exports = { applyInventoryFromPurchase, setInventoryApplied };