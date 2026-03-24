// src/routes/serials.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/serial_controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

// Rutas del Hub de Identidad (IMEIs)
router.get("/all", verifyToken, ctrl.getAll);
router.get("/assignable-items", verifyToken, ctrl.getAssignableItems);
router.post("/bulk-register", verifyToken, ctrl.bulkRegister);

module.exports = router;