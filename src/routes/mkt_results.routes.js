const { Router } = require("express");
const ctrl = require("../controllers/mkt_results.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia
const router = Router();

router.get("/",verifyToken, ctrl.getDashboard);

module.exports = router;