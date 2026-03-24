// src/controllers/suppliers.controller.js
const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const model = require("../models/suppliers.model");

function toId(v) {
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function clean(v) {
  return (v ?? "").toString().trim();
}

exports.list = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const data = await model.listSuppliers(tenantId);
  return ok(res, data);
});

exports.getById = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "BAD_ID", message: "ID inválido" });

  const supplier = await model.getSupplierById(id, tenantId);
  if (!supplier) return res.status(404).json({ ok: false, error: "NOT_FOUND", message: "Proveedor no existe" });

  return ok(res, supplier);
});

exports.create = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const nombre = clean(req.body.nombre || req.body.name);
  
  if (!nombre) return res.status(400).json({ ok: false, error: "VALIDATION", message: "El nombre es obligatorio" });

  // AGREGAMOS LOS CAMPOS FALTANTES AQUÍ:
  const supplier = await model.createSupplier({
    tenant_id: tenantId,
    rif: clean(req.body.rif), // <--- Faltaba
    nombre,
    contacto: clean(req.body.contacto), // <--- Faltaba
    telefono: clean(req.body.telefono || req.body.phone),
    email: clean(req.body.email),
    ubicacion: clean(req.body.ubicacion || req.body.address),
    condiciones_pago: clean(req.body.condiciones_pago), // <--- Faltaba
    notas: clean(req.body.notas || req.body.notes),
  }, req.user); // Pasamos req.user para la auditoría

  return created(res, supplier);
});

exports.update = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "BAD_ID", message: "ID inválido" });

  const nombre = clean(req.body.nombre || req.body.name);
  if (!nombre) return res.status(400).json({ ok: false, error: "VALIDATION", message: "El nombre es obligatorio" });

  // AGREGAMOS LOS CAMPOS FALTANTES AQUÍ TAMBIÉN:
  const updated = await model.updateSupplier(id, {
    rif: clean(req.body.rif), // <--- Faltaba
    nombre,
    contacto: clean(req.body.contacto), // <--- Faltaba
    telefono: clean(req.body.telefono || req.body.phone),
    email: clean(req.body.email),
    ubicacion: clean(req.body.ubicacion || req.body.address),
    condiciones_pago: clean(req.body.condiciones_pago), // <--- Faltaba
    notas: clean(req.body.notas || req.body.notes),
  }, tenantId, req.user);

  if (!updated) return res.status(404).json({ ok: false, error: "NOT_FOUND", message: "Proveedor no existe" });

  return ok(res, updated);
});

exports.remove = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "BAD_ID", message: "ID inválido" });

  const deleted = await model.deleteSupplier(id, tenantId);
  if (!deleted) return res.status(404).json({ ok: false, error: "NOT_FOUND", message: "Proveedor no existe" });

  return ok(res, { id, deleted: true });
});
