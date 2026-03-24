const { Router } = require("express");
const controller = require("../controllers/mkt_ads.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

// Rutas de Públicos
router.get("/audiences",verifyToken, controller.listAudiences);
router.post("/audiences",verifyToken, controller.addAudience);
router.delete("/audiences/:id",verifyToken, controller.removeAudience);

// Rutas de Campañas
router.get("/campaigns",verifyToken, controller.listCampaigns);
router.post("/campaigns",verifyToken, controller.addCampaign);
router.put("/campaigns/:id",verifyToken, controller.editCampaign);

module.exports = router;