const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const purchasesModel = require("../models/purchases.model");
const invModel = require("../models/purchase_items.model");
const suppliesModel = require("../models/supplies.model"); 
const { pool } = require("../db");
const payModel = require("../models/supplier_payments.model");
const routingModel = require("../models/finance_routing.model");
const { processPaymentMultiCurrency } = require("../utils/financeHelper");

// --- Auxiliares de limpieza ---
function toId(v) { const n = Number(v); return Number.isNaN(n) ? null : n; }
function normStatus(s) { return (s || "").toString().trim().toUpperCase(); }
function normCondition(c) { return (c || "").toString().trim().toUpperCase(); }
function normMethod(m) { return (m || "").toString().trim().toUpperCase(); }

function getTenantId(req) {
  return req.headers["x-tenant-id"] || req.user?.tenant_id || req.user?.tenantId;
}

// --- Función centralizada para manejar pagos automáticos ---
async function handleAutomaticPayments(paymentsList, purchaseData, tenantId, user) {
  if (!Array.isArray(paymentsList) || paymentsList.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // 1. Aseguramos el Tenant ID como string simple
    const tId = String(tenantId);
    await client.query(`SELECT set_config('app.current_tenant_id', '${tId}', true)`);

    // 2. Eliminamos el "FOR UPDATE" momentáneamente para descartar bloqueos de driver
    const lock = await client.query("SELECT supplier_id FROM purchases WHERE id=$1 AND tenant_id=$2", [purchaseData.id, tenantId]);
    if (lock.rowCount === 0) throw new Error("La compra no existe.");
    
    const supplierId = lock.rows[0].supplier_id;

    for (const pay of paymentsList) {
      const payAmountUSD = Number(pay.amount);
      if (payAmountUSD <= 0) continue;

      // Usamos el ID de cuenta que viene del front o buscamos el default
      let accId = toId(pay.finance_account_id);
      if (!accId) {
         accId = await routingModel.getDefaultAccountIdByMethod(normMethod(pay.method), client);
      }
      
      if (!accId) throw new Error(`No hay cuenta configurada para: ${pay.method}`);

      const accRes = await client.query('SELECT currency FROM finance_accounts WHERE id = $1', [accId]);
      const accCurrency = accRes.rows[0]?.currency || 'USD';
      
      const currentRate = parseFloat(pay.exchange_rate) || parseFloat(purchaseData.exchange_rate) || 1;
      const fin = processPaymentMultiCurrency(payAmountUSD, currentRate, accCurrency);

      // ¡OJO AQUÍ! Revisa que createSupplierPaymentTx no use "//" en su SQL interno
      await payModel.createSupplierPaymentTx(client, {
        tenant_id: tenantId,
        supplier_id: supplierId,
        purchase_id: purchaseData.id,
        amount: fin.amount,             
        method: normMethod(pay.method), 
        finance_account_id: accId,
        ref: pay.ref || 'Pago Auto Contado',
        notes: pay.notes || "Pago automático multipago",
        exchange_rate: fin.exchange_rate,
        currency_code: fin.currency     
      }, user); 
    }

    await client.query("COMMIT");
  } catch (e) { 
    await client.query("ROLLBACK"); 
    console.error("DETALLE ERROR SQL:", e); // Esto te dirá el query exacto que falló
    throw e; 
  } finally { 
    client.release(); 
  }
}

// --- Métodos del Controlador ---

exports.list = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await purchasesModel.listPurchases(tenantId);
  return ok(res, data);
});

exports.getById = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const tenantId = getTenantId(req);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const header = await purchasesModel.getPurchaseHeaderById(id, tenantId);
  if (!header) return res.status(404).json({ error: "No existe o no pertenece a tu empresa" });

  const items = await purchasesModel.getPurchaseItemsByPurchaseId(id, tenantId);
  return ok(res, { ...header, items });
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const tenantId = getTenantId(req);

  // --- LIMPIEZA DE DATOS (Para evitar VALIDATION_ERROR) ---
  const payload = {
    tenant_id: tenantId,
    supplier_id: toId(b.supplier_id),
    status: normStatus(b.status) || "BORRADOR",
    invoice_ref: b.invoice_ref && b.invoice_ref.trim() !== "" ? b.invoice_ref : `REF-${Date.now()}`,
    notes: b.notes || null,
    purchase_date: b.purchase_date || new Date().toISOString(),
    condition: normCondition(b.condition) || "CONTADO",
    due_date: b.condition === "CREDITO" ? b.due_date : null,
    currency_code: b.currency_code || 'USD',
    exchange_rate: parseFloat(b.exchange_rate) || 1,
    items: Array.isArray(b.items) ? b.items : []
  };

  // Validaciones mínimas antes de llamar al modelo
  if (!payload.supplier_id) return res.status(400).json({ error: "supplier_id obligatorio" });
  if (payload.items.length === 0) return res.status(400).json({ error: "La compra debe tener al menos 1 artículo" });

  // Llamada al modelo con el payload limpio
  const result = await purchasesModel.createPurchaseWithItems(payload, req.user);

  const st = payload.status;
  const cond = payload.condition;
  
  if (st === "CONFIRMADA") {
    // Aplicar inventario
    await invModel.applyInventoryFromPurchase(result.id, +1, tenantId, req.user);
    await invModel.setInventoryApplied(result.id, true, tenantId);

    // Actualizar costos de suministros
    const items = await purchasesModel.getPurchaseItemsByPurchaseId(result.id, tenantId);
    for (const it of items) {
      if (it.supply_id) {
        await suppliesModel.updateCostAndSupplier(it.supply_id, it.unit_cost, payload.supplier_id, tenantId);
      }
    }

    // Procesar pagos si es CONTADO
    if (cond === "CONTADO" && Array.isArray(b.payments) && b.payments.length > 0) {
      const purchaseData = { id: result.id, exchange_rate: payload.exchange_rate };
      await handleAutomaticPayments(b.payments, purchaseData, tenantId, req.user);
    }
  }
  
  return created(res, result);
});
exports.update = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const tenantId = getTenantId(req);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const before = await purchasesModel.getPurchaseHeaderById(id, tenantId);
  if (!before) return res.status(404).json({ error: "Compra no encontrada" });

  const patch = req.body || {};

  // 1. Reemplazo de items
  if (Array.isArray(patch.items)) {
    if (before.inventory_applied) {
      return res.status(400).json({ error: "No puedes editar items si el inventario ya fue aplicado." });
    }
    await purchasesModel.replacePurchaseItems(id, patch.items, tenantId, req.user);
  }

  // 2. Actualizar cabecera básica
  const updated = await purchasesModel.updatePurchaseBasic(id, patch, tenantId, req.user);
  
  const wasApplied = !!before.inventory_applied;
  const newStatus = normStatus(updated.status);
  const newCondition = normCondition(updated.condition);
  const isConfirmTransition = newStatus === "CONFIRMADA" && normStatus(before.status) !== "CONFIRMADA";

  // 3. Lógica de Inventario (Confirmar)
  if (newStatus === "CONFIRMADA" && !wasApplied) {
    await invModel.applyInventoryFromPurchase(id, +1, tenantId, req.user);
    await invModel.setInventoryApplied(id, true, tenantId);

    const items = await purchasesModel.getPurchaseItemsByPurchaseId(id, tenantId);
    for (const it of items) {
      if (it.supply_id) {
        await suppliesModel.updateCostAndSupplier(it.supply_id, it.unit_cost, updated.supplier_id, tenantId);
      }
    }
  }

  // 4. Pago automático al confirmar una compra de contado
  if (isConfirmTransition && newCondition === "CONTADO") {
    const paymentsList = Array.isArray(patch.payments) ? patch.payments : [];
    await handleAutomaticPayments(paymentsList, updated, tenantId, req.user);
  }

  // 5. Lógica de Inventario (Anular)
  if (newStatus === "ANULADA" && wasApplied) {
    await invModel.applyInventoryFromPurchase(id, -1, tenantId, req.user);
    await invModel.setInventoryApplied(id, false, tenantId);
  }

  const header = await purchasesModel.getPurchaseHeaderById(id, tenantId);
  const finalItems = await purchasesModel.getPurchaseItemsByPurchaseId(id, tenantId);
  
  return ok(res, { ...header, items: finalItems });
});