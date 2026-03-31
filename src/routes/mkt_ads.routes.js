const { Router } = require("express");
const controller = require("../controllers/mkt_ads.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

// Rutas de Públicos
router.get("/audiences",verifyToken, checkModuleAccess("mkt_ads"), controller.listAudiences);
router.post("/audiences",verifyToken, checkModuleAccess("mkt_ads"), controller.addAudience);
router.delete("/audiences/:id",verifyToken, checkModuleAccess("mkt_ads"), controller.removeAudience);

// Rutas de Campañas
router.get("/campaigns",verifyToken, checkModuleAccess("mkt_ads"), controller.listCampaigns);
router.post("/campaigns",verifyToken, checkModuleAccess("mkt_ads"), controller.addCampaign);
router.put("/campaigns/:id",verifyToken, checkModuleAccess("mkt_ads"), controller.editCampaign);

module.exports = router;