const router = require("express").Router();
const mainCtrl = require("../controllers/dashboard_main.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia


router.get("/",verifyToken, mainCtrl.getMainDashboard);

module.exports = router;