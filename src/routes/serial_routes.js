// src/routes/serials.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/serial_controller");
const { verifyToken, checkModuleAccess} = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

// Rutas del Hub de Identidad (IMEIs)
router.get("/all", verifyToken, checkModuleAccess("serials"), ctrl.getAll);
router.get("/assignable-items", verifyToken, checkModuleAccess("serials"), ctrl.getAssignableItems);
router.post("/bulk-register", verifyToken, checkModuleAccess("serials"), ctrl.bulkRegister);

module.exports = router;