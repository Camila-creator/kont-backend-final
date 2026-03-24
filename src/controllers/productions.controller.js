const productionsModel = require("../models/productions.model");

async function list(req, res, next) {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const data = await productionsModel.listProductions(tenantId);
    res.json({ ok: true, data });
  } catch (e) { next(e); }
}

async function preview(req, res, next) {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const product_id = Number(req.query.product_id);
    const qty_made = Number(req.query.qty_made || 1);

    if (!product_id) return res.status(400).json({ ok: false, message: "product_id es requerido" });

    // Llamamos al modelo
    const result = await productionsModel.previewProduction({ product_id, qty_made, tenant_id: tenantId });
    
    // Si result.ok es false (ej: "Producto sin receta"), devolvemos el error
    if (!result.ok) {
        return res.status(400).json({ ok: false, message: result.error });
    }

    // Si todo bien, devolvemos el resultado directo
    res.json({ ok: true, data: result }); 
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { product_id, qty_made, notes, production_date } = req.body;

    if (!product_id) return res.status(400).json({ ok: false, message: "product_id es requerido" });
    if (!qty_made || Number(qty_made) <= 0) return res.status(400).json({ ok: false, message: "qty_made debe ser > 0" });

    const data = await productionsModel.createProduction({
      tenant_id: tenantId,
      product_id: Number(product_id),
      qty_made: Number(qty_made),
      notes: notes || null,
      production_date: production_date || null,
    });

    if (!data?.ok) return res.status(400).json({ ok: false, message: data?.error || "No se pudo producir" });

    res.json({ ok: true, data });
  } catch (e) { next(e); }
}

module.exports = { list, preview, create };