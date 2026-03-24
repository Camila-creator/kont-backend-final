// src/controllers/supplier_payments.controller.js
const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const db = require("../db"); // Importamos el wrapper que tiene el pool
const payModel = require("../models/supplier_payments.model");

// Helpers de validación
function toNum(v) { const n = Number(v); return Number.isNaN(n) ? null : n; }
function normMethod(m) { return (m || "").toString().trim().toUpperCase(); }

const ALLOWED = new Set(["TRANSFERENCIA", "PAGO_MOVIL", "EFECTIVO", "ZELLE", "CUENTA_EXTRANJERA"]);

/**
 * Lista todos los pagos de la empresa actual
 */
exports.list = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  
  const data = await payModel.listSupplierPayments({
    tenant_id: tenantId,
    supplier_id: req.query.supplier_id,
    purchase_id: req.query.purchase_id
  });
  
  return ok(res, data);
});

/**
 * Crea un pago nuevo dentro de una transacción segura
 */
exports.create = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const b = req.body || {};

  // 1. Extracción y validación básica
  const supplier_id = toNum(b.supplier_id);
  const purchase_id = b.purchase_id != null ? toNum(b.purchase_id) : null;
  const amount = Number(b.amount);
  const finance_account_id = toNum(b.finance_account_id); 

  if (!supplier_id) return res.status(400).json({ error: "supplier_id obligatorio" });
  if (!purchase_id) return res.status(400).json({ error: "purchase_id obligatorio" });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "monto inválido" });
  if (!finance_account_id) return res.status(400).json({ error: "finance_account_id obligatorio" });

  const method = normMethod(b.method);
  if (!ALLOWED.has(method)) return res.status(400).json({ error: `método de pago inválido` });

  let paid_at = b.paid_at ? b.paid_at : (b.payment_date ? `${b.payment_date} 12:00:00` : null);
  const ref = b.ref ?? b.reference ?? null;
  const notes = b.notes ?? null;

  // 2. Inicio de Transacción Manual
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 🛡️ PASO CRÍTICO: Identificamos al Tenant en esta conexión de Postgres
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

    // 3. Obtener y bloquear la compra (FOR UPDATE)
    // Ya no necesitamos 'AND tenant_id' porque el RLS filtrará si no nos pertenece
    const hdr = await client.query(
      `SELECT id, supplier_id, status FROM purchases WHERE id = $1 FOR UPDATE`,
      [purchase_id]
    );

    const purchase = hdr.rows[0];
    if (!purchase) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "La compra no existe o no tienes permiso para verla" });
    }

    // 4. Validaciones de negocio
    const st = String(purchase.status || "").toUpperCase();
    if (st === "ANULADA") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No se puede registrar pagos en una compra ANULADA" });
    }

    if (Number(purchase.supplier_id) !== Number(supplier_id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El proveedor no coincide con el de la compra original" });
    }

    // 5. Verificar montos pendientes
    // Gracias a nuestra política de RLS con 'EXISTS', purchase_items también está blindada
    const totRes = await client.query(
      `SELECT COALESCE(SUM(total),0) AS total FROM purchase_items WHERE purchase_id = $1`,
      [purchase_id]
    );
    const total = Number(totRes.rows[0]?.total || 0);

    const paid = await payModel.sumPaidByPurchaseId(purchase_id, client, tenantId);
    const pending = Math.max(0, total - paid);

    if (amount > (pending + 0.01)) { // Margen pequeño para errores de redondeo
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Exceso de pago. Pendiente actual: ${pending.toFixed(2)}` });
    }

    // 6. Guardar el pago
    const saved = await payModel.createSupplierPaymentTx(client, {
      tenant_id: tenantId,
      supplier_id, 
      purchase_id, 
      amount, 
      method, 
      finance_account_id, 
      ref, 
      paid_at, 
      notes
    });

    await client.query("COMMIT");
    return created(res, saved);

  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error en createSupplierPayment:", e);
    return res.status(500).json({ error: "Error interno al procesar el pago" });
  } finally {
    client.release();
  }
});