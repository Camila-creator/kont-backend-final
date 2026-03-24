const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const model = require("../models/supplies.model");

// Helpers de limpieza
const toId = (v) => { const n = Number(v); return Number.isNaN(n) ? null : n; };
const clean = (v) => (v ?? "").toString().trim();
const toNum = (v) => { const n = Number(v); return Number.isNaN(n) ? 0 : n; };
const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";

exports.list = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const data = await model.listSupplies(tenantId);
  return ok(res, data);
});

exports.getById = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "BAD_ID", message: "ID inválido" });

  const item = await model.getSupplyById(id, tenantId);
  if (!item) return res.status(404).json({ ok: false, error: "NOT_FOUND", message: "Insumo no existe" });

  return ok(res, item);
});

exports.create = asyncHandler(async (req, res) => {
  // 1. Extraer Tenant ID del Token
  const tenantId = req.user.tenant_id || req.user.tenantId;

  // 2. Validaciones básicas
  const nombre = clean(req.body.nombre || req.body.name);
  const proveedor_id = toId(req.body.proveedor_id ?? req.body.supplier_id);
  
  if (!nombre) return res.status(400).json({ ok: false, message: "El nombre es obligatorio" });
  if (!proveedor_id) return res.status(400).json({ ok: false, message: "El proveedor es obligatorio" });

  // 3. Llamar al modelo pasando data y LUEGO tenantId (separados)
  const createdRow = await model.createSupply({
    nombre,
    // CORRECCIÓN AQUÍ: Leemos categoria_id y lo pasamos con la misma llave
    categoria_id: toId(req.body.categoria_id || req.body.category_id), 
    unidad: clean(req.body.unidad || req.body.unit) || "UNIDAD",
    proveedor_id,
    costo: toNum(req.body.costo ?? req.body.cost),
    stock: toNum(req.body.stock),
    min_stock: toNum(req.body.min_stock ?? req.body.minStock),
    has_expiry: toBool(req.body.has_expiry ?? req.body.hasExpiry),
    expiry_date: clean(req.body.expiry_date ?? req.body.expiryDate) || null,
  }, tenantId, req.user); // No olvides pasar req.user si tu modelo usa la auditoría

  return created(res, createdRow);
});

exports.update = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: "ID inválido" });

  const updated = await model.updateSupply(id, {
    nombre: clean(req.body.nombre || req.body.name),
    // CORRECCIÓN AQUÍ TAMBIÉN
    categoria_id: toId(req.body.categoria_id || req.body.category_id), 
    unidad: clean(req.body.unidad || req.body.unit),
    proveedor_id: toId(req.body.proveedor_id ?? req.body.supplier_id),
    costo: toNum(req.body.costo),
    stock: toNum(req.body.stock),
    min_stock: toNum(req.body.min_stock),
    has_expiry: toBool(req.body.has_expiry),
    expiry_date: clean(req.body.expiry_date) || null,
  }, tenantId, req.user); // Pasar req.user para la auditoría

  if (!updated) return res.status(404).json({ ok: false, message: "No se pudo actualizar" });
  return ok(res, updated);
});

exports.remove = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const id = toId(req.params.id);
  
  const deleted = await model.deleteSupply(id, tenantId, req.user); // Pasar req.user aquí también
  if (!deleted) return res.status(404).json({ ok: false, message: "Insumo no encontrado" });

  return ok(res, { id, deleted: true });
});