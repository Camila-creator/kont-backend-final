const { Router } = require("express");
const controller = require("../controllers/mkt_offline.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

router.get("/activities",verifyToken, checkModuleAccess("mkt_offline"), controller.listActivities);
router.post("/activities",verifyToken, checkModuleAccess("mkt_offline"), controller.addActivity);
router.put("/activities/:id",verifyToken, checkModuleAccess("mkt_offline"), controller.editActivity);

module.exports = router;