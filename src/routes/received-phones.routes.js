const router = require("express").Router();
const ctrl = require("../controllers/received-phones.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");

// Listar equipos en el limbo
router.get("/", verifyToken, checkModuleAccess("received_phones"), ctrl.getPending);

// Procesar equipo hacia inventario o repuestos
// Aquí podrías añadir un validate(receivedPhoneSchema) si lo deseas
router.post("/process", verifyToken, checkModuleAccess("received_phones"), ctrl.processIntoInventory);

module.exports = router;