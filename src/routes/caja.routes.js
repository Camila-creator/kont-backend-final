// backend/routes/caja.routes.js
const router = require("express").Router();
const cajaCtrl = require("../controllers/caja.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

// Obtener el resumen de un día específico (Ingresos, Egresos, Movimientos)
router.get("/resumen", verifyToken, cajaCtrl.getResumenDiario);

// Ejecutar el cierre formal de la caja
router.post("/cierre", verifyToken, cajaCtrl.cerrarCaja);

module.exports = router;