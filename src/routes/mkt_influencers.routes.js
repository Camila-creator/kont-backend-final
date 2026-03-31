const { Router } = require("express");
const ctrl = require("../controllers/mkt_influencers.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia
const router = Router();
router.get("/",verifyToken, checkModuleAccess("mkt_influencers"), ctrl.list);
router.post("/",verifyToken, checkModuleAccess("mkt_influencers"), ctrl.add);
router.put("/:id",verifyToken, checkModuleAccess("mkt_influencers"), ctrl.edit);
module.exports = router;