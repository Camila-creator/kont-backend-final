const router = require("express").Router();
const mainCtrl = require("../controllers/dashboard_main.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia


router.get("/",verifyToken, checkModuleAccess("dashboard_main"), mainCtrl.getMainDashboard);

module.exports = router;