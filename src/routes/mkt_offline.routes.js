const { Router } = require("express");
const controller = require("../controllers/mkt_offline.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

router.get("/activities",verifyToken, controller.listActivities);
router.post("/activities",verifyToken, controller.addActivity);
router.put("/activities/:id",verifyToken, controller.editActivity);

module.exports = router;