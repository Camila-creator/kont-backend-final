const router = require("express").Router();
const intelCtrl = require("../controllers/intelligence.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

// Obtener el Dashboard Estratégico (Throughput, Inventario, Marketing y Pulso de Caja)
router.get("/strategic-dashboard", verifyToken, checkModuleAccess("intelligence"), intelCtrl.getStrategicDashboard);

// Aquí podrías meter a futuro rutas de reportes pesados
// router.get("/reports/inventory-leaks", verifyToken, intelCtrl.getInventoryAnalysis);

module.exports = router; 