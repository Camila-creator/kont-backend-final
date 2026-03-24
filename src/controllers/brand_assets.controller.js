const BrandAssetsModel = require("../models/brand_assets.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

async function getBrandBook(req, res, next) {
  try {
    const assets = await BrandAssetsModel.listBrandAssets(getTenant(req));
    const data = {
      adn: assets.filter(a => a.tipo === 'filosofia'),
      estrategia: assets.filter(a => a.tipo === 'estrategia'),
      logos: assets.filter(a => a.tipo === 'logo'),
      colores: assets.filter(a => a.tipo === 'color'),
      empaque: assets.filter(a => a.tipo === 'empaque').sort((a, b) => Number(a.valor) - Number(b.valor))
    };
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

async function updateAsset(req, res, next) {
  try {
    const { id, descripcion, valor } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "El ID es obligatorio." });
    
    const updatedAsset = await BrandAssetsModel.updateBrandAsset({ id, descripcion, valor }, getTenant(req));
    res.json({ success: true, data: updatedAsset, message: "Actualizado correctamente" });
  } catch (error) { next(error); }
}

module.exports = { getBrandBook, updateAsset };