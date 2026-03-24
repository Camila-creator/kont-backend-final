// backend/controllers/orders.controller.js
const OrderModel = require("../models/orders.model");

exports.list = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id; 
    if (!tenantId) return res.status(401).json({ error: "No se detectó la empresa." });
    
    const orders = await OrderModel.listOrders(tenantId);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: "Acceso denegado." });

    const order = await OrderModel.getOrderFullById(req.params.id, tenantId);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
    
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: "No se detectó la empresa." });

    const order = await OrderModel.createOrder(req.body, tenantId, req.user);
    res.status(201).json(order);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: "Acceso denegado." });

    const updated = await OrderModel.updateOrder(req.params.id, req.body, tenantId, req.user);
    if (!updated) return res.status(404).json({ error: "Pedido no encontrado." });
    
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// 🟢 ESTA ES LA QUE NECESITAS PARA EL BOTÓN DE "REGISTRAR PAGO"
exports.createPayment = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: "No se detectó la empresa." });

    // 🚩 USAMOS ORDERMODEL PORQUE AHÍ VAMOS A METER LA FUNCIÓN
    // (Asegúrate de que en tu orders.model.js exista la función 'addPaymentToOrder')
    const payment = await OrderModel.addPaymentToOrder(req.body, tenantId);
    
    res.status(201).json(payment);
  } catch (e) {
    console.error("Error al registrar pago:", e.message);
    res.status(400).json({ error: e.message });
  }
};