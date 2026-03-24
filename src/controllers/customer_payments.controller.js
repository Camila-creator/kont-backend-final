const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const payModel = require("../models/customer_payments.model");

const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

function toNum(v) { 
    const n = Number(v); 
    return Number.isNaN(n) ? null : n; 
}

function normMethod(m) { 
    return (m || "").toString().trim().toUpperCase(); 
}

// 🛡️ LISTA ACTUALIZADA: Ahora incluye los métodos de tu tienda de tecnología
const ALLOWED = new Set([
    "TRANSFERENCIA", 
    "PAGO_MOVIL", 
    "EFECTIVO", 
    "ZELLE", 
    "CUENTA_EXTRANJERA",
    "BINANCE",        // Agregado para tu flujo actual
    "EQUIPO_USADO",   // <--- ESTO DESBLOQUEA TU ERROR
    "PUNTO_VENTA"
]);

exports.list = asyncHandler(async (req, res) => {
  const data = await payModel.listCustomerPayments({ 
      customer_id: req.query.customer_id, 
      order_id: req.query.order_id, 
      tenant_id: getTenant(req) 
  });
  return ok(res, data);
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body || {};
  
  const customer_id = toNum(b.customer_id); 
  const order_id = b.order_id != null && b.order_id !== "" ? toNum(b.order_id) : null; 
  const amount = toNum(b.amount);

  // Validaciones básicas
  if (!customer_id) return res.status(400).json({ error: "customer_id obligatorio" });
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount inválido" });

  const method = normMethod(b.method);
  if (!method) return res.status(400).json({ error: "method obligatorio" });
  
  // 🚫 Si el método no está en la lista (como EQUIPO_USADO), aquí es donde daba el error 400
  if (!ALLOWED.has(method)) {
      return res.status(400).json({ error: "method inválido" });
  }

  // Manejo de fecha
  let paid_at = null; 
  if (b.paid_at) paid_at = b.paid_at; 
  else if (b.payment_date) paid_at = `${b.payment_date} 12:00:00`;

  // 🚀 ENVIAR AL MODELO
  // Agregamos phone_model para que la transacción en el model lo reciba
  const saved = await payModel.createCustomerPayment({ 
      tenant_id: getTenant(req), 
      customer_id, 
      order_id, 
      amount, 
      method, 
      ref: b.ref ?? b.reference ?? null, 
      paid_at, 
      notes: b.notes ?? null,
      phone_model: b.phone_model || null // <--- CLAVE: Para el limbo de equipos
  }, req.user); // Pasamos req.user para que el log de auditoría sepa quién fue

  return created(res, saved);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id); 
  if (!id) return res.status(400).json({ error: "id inválido" });
  
  const deleted = await payModel.deleteCustomerPayment(id, getTenant(req), req.user);
  if (!deleted) return res.status(404).json({ error: "No existe" }); 
  
  return ok(res, deleted);
});