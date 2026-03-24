const { Router } = require("express");
const controller = require("../controllers/mkt_calendar.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

// Rutas para Métricas del CM
router.get("/metrics",verifyToken, controller.fetchMetrics);
router.post("/metrics",verifyToken, controller.recordMetrics);

// Rutas para Posts del Calendario
router.get("/posts",verifyToken, controller.listPosts);
router.post("/posts",verifyToken, controller.addPost);
router.put("/posts/:id",verifyToken, controller.editPost);

module.exports = router;