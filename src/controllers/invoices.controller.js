// src/controllers/invoices.controller.js
const model = require("../models/invoices.model");
const IS_PROD = process.env.NODE_ENV === "production";

// GET /api/invoices — Listar facturas
exports.list = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const data = await model.listInvoices(tenantId);
    res.json({ ok: true, data });
  } catch (err) {
    console.error("Error en invoices.list:", err.message);
    res.status(500).json({ ok: false, error: IS_PROD ? "Error interno." : err.message });
  }
};

// GET /api/invoices/:id — Obtener factura completa
exports.getById = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const invoice = await model.getInvoiceById(req.params.id, tenantId);
    if (!invoice) return res.status(404).json({ ok: false, error: "Factura no encontrada." });
    res.json({ ok: true, data: invoice });
  } catch (err) {
    console.error("Error en invoices.getById:", err.message);
    res.status(500).json({ ok: false, error: IS_PROD ? "Error interno." : err.message });
  }
};

// POST /api/invoices — Crear factura desde pedido
exports.create = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { order_id } = req.body;

    if (!order_id) return res.status(400).json({ ok: false, error: "order_id es requerido." });

    const invoice = await model.createInvoiceFromOrder(order_id, tenantId, req.user);
    res.status(201).json({ ok: true, data: invoice });
  } catch (err) {
    // Errores de negocio (pedido no confirmado, ya facturado) → 400
    if (err.message.includes("CONFIRMADO") || err.message.includes("ya tiene una factura") || err.message.includes("no encontrado")) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    console.error("Error en invoices.create:", err.message);
    res.status(500).json({ ok: false, error: IS_PROD ? "Error interno." : err.message });
  }
};
