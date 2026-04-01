// src/controllers/products.controller.js
const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const model = require("../models/products.model");

function toId(v) {
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

exports.list = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const data = await model.listProducts(tenantId);
  return ok(res, data);
});

exports.getById = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const p = await model.getProductById(id, tenantId);
  if (!p) return res.status(404).json({ error: "Producto no encontrado" });

  return ok(res, p);
});

// BUG 4 FIX: eliminar cálculo duplicado de product_number
// El model ya lo calcula atómicamente con MAX(product_number)+1 en SQL
// El cálculo en el controller era código muerto que podía causar race conditions
exports.create = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const p = req.body;

  if (!p.nombre && !p.name) {
    return res.status(400).json({ error: "El nombre del producto es obligatorio" });
  }

  const product = await model.createProduct({
    ...p,
    name: p.nombre || p.name,
    tenant_id: tenantId,
  }, req.user);

  return created(res, product);
});

exports.update = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const updated = await model.updateProduct(id, req.body, tenantId, req.user);
  if (!updated) return res.status(404).json({ error: "Producto no encontrado o sin permiso" });

  return ok(res, updated);
});

exports.remove = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const deleted = await model.deleteProduct(id, tenantId);
  if (!deleted) return res.status(404).json({ error: "Producto no encontrado o sin permiso" });

  return ok(res, { id, deleted: true });
});
