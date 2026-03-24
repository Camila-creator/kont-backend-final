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
  if (!p) return res.status(404).json({ error: "No existe" });

  return ok(res, p);
});


exports.create = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const p = req.body;

  if (!p.nombre && !p.name) return res.status(400).json({ error: "Nombre obligatorio" });

  // 1. OBTENER EL SIGUIENTE NÚMERO CORRELATIVO
  // Aquí llamamos a una función del modelo que cuente los productos del tenant
  const totalProducts = await model.countProductsByTenant(tenantId);
  const nextProductNumber = totalProducts + 1;

  // 2. CREAR EL PRODUCTO CON EL NÚMERO ASIGNADO
  const product = await model.createProduct({ 
      ...p, 
      name: p.nombre || p.name,
      product_number: nextProductNumber, // <--- Guardamos el número amigable
      tenant_id: tenantId 
  }, req.user); 
  
  return created(res, product);
});

// En src/controllers/products.controller.js

exports.update = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  // Agrega req.user al final de esta línea 👇
  const updated = await model.updateProduct(id, req.body, tenantId, req.user);
  
  if (!updated) return res.status(404).json({ error: "No existe o no tienes permiso" });

  return ok(res, updated);
});

exports.remove = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const deleted = await model.deleteProduct(id, tenantId);
  if (!deleted) return res.status(404).json({ error: "No existe o no tienes permiso" });

  return ok(res, { id, deleted: true });
});