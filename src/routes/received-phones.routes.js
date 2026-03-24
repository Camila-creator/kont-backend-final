const router = require("express").Router();
const ctrl = require("../controllers/received-phones.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Listar equipos en el limbo
router.get("/", verifyToken, ctrl.getPending);

// Procesar equipo hacia inventario o repuestos
// Aquí podrías añadir un validate(receivedPhoneSchema) si lo deseas
router.post("/process", verifyToken, ctrl.processIntoInventory);

module.exports = router;