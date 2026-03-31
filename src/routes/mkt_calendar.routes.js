const { Router } = require("express");
const controller = require("../controllers/mkt_calendar.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

// Rutas para Métricas del CM
router.get("/metrics",verifyToken, checkModuleAccess("mkt_calendar"), controller.fetchMetrics);
router.post("/metrics",verifyToken, checkModuleAccess("mkt_calendar"), controller.recordMetrics);

// Rutas para Posts del Calendario
router.get("/posts",verifyToken, checkModuleAccess("mkt_calendar"), controller.listPosts);
router.post("/posts",verifyToken, checkModuleAccess("mkt_calendar"), controller.addPost);
router.put("/posts/:id",verifyToken, checkModuleAccess("mkt_calendar"), controller.editPost);

module.exports = router;