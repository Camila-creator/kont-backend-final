// src/controllers/orders.controller.js
// SEGURIDAD 3 FIX: errores 500 no exponen e.message al cliente en producción
// Los 400 SÍ exponen el mensaje porque son errores de validación intencionales
// (ej: "Stock insuficiente: producto X tiene 3, necesitas 10")
const OrderModel = require("../models/orders.model");

const IS_PROD = process.env.NODE_ENV === "production";

function serverError(res, err, context) {
  console.error(`[orders.controller] ${context}:`, err.message);
  return res.status(500).json({
    error: IS_PROD ? "Error interno del servidor." : err.message,
  });
}

exports.list = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "No se detectó la empresa." });

    const orders = await OrderModel.listOrders(tenantId);
    res.json(orders);
  } catch (e) {
    serverError(res, e, "list");
  }
};

exports.getById = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Acceso denegado." });

    const order = await OrderModel.getOrderFullById(req.params.id, tenantId);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado." });

    res.json(order);
  } catch (e) {
    serverError(res, e, "getById");
  }
};

exports.create = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "No se detectó la empresa." });

    const order = await OrderModel.createOrder(req.body, tenantId, req.user);
    res.status(201).json(order);
  } catch (e) {
    // 400: errores de validación/negocio que el usuario debe ver (ej: stock insuficiente)
    if (e.message?.includes("Stock insuficiente") || e.message?.includes("no puede tener más")) {
      return res.status(400).json({ error: e.message });
    }
    serverError(res, e, "create");
  }
};

exports.update = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Acceso denegado." });

    const updated = await OrderModel.updateOrder(req.params.id, req.body, tenantId, req.user);
    if (!updated) return res.status(404).json({ error: "Pedido no encontrado." });

    res.json(updated);
  } catch (e) {
    if (e.message?.includes("Stock insuficiente")) {
      return res.status(400).json({ error: e.message });
    }
    serverError(res, e, "update");
  }
};

exports.createPayment = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "No se detectó la empresa." });

    const payment = await OrderModel.addPaymentToOrder(req.body, tenantId);
    res.status(201).json(payment);
  } catch (e) {
    serverError(res, e, "createPayment");
  }
};
