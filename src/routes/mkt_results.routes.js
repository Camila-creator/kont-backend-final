const { Router } = require("express");
const ctrl = require("../controllers/mkt_results.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia
const router = Router();

router.get("/",verifyToken, checkModuleAccess("mkt_results"), ctrl.getDashboard);

module.exports = router;