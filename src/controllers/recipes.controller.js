// src/controllers/recipes.controller.js
const recipesModel = require("../models/recipes.model");

async function list(req, res, next) {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const data = await recipesModel.listRecipes(tenantId);
    res.json({ ok: true, data });
  } catch (e) { next(e); }
}

async function getByProduct(req, res, next) {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const productId = Number(req.params.productId);
    const data = await recipesModel.getRecipeByProductId(productId, tenantId);
    res.json({ ok: true, data });
  } catch (e) { next(e); }
}

async function upsert(req, res, next) {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { product_id, notes, items } = req.body;

    if (!product_id) return res.status(400).json({ ok: false, message: "product_id es requerido" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ ok: false, message: "items debe tener al menos 1 insumo" });

    const parsedItems = items.map((it) => ({
      supply_id: Number(it.supply_id),
      qty: Number(it.qty),
      unit: (it.unit ?? "").toString().trim() || null,
    }));

    const data = await recipesModel.upsertRecipeByProductId({
      tenant_id: tenantId,
      product_id: Number(product_id),
      notes: notes || null,
      items: parsedItems,
    });

    res.json({ ok: true, data });
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const productId = Number(req.params.productId);
    const data = await recipesModel.deleteRecipeByProductId(productId, tenantId);
    res.json({ ok: true, data });
  } catch (e) { next(e); }
}

// ¡AQUÍ ESTABA EL DETALLE! Exportando exactamente lo que el router necesita:
module.exports = { list, getByProduct, upsert, remove };