// backend/routes/orders.routes.js
const express = require("express");
const ctrl = require("../controllers/orders.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validator.middleware"); // Importamos el escudo
const { orderCreateSchema } = require("../schemas/order.schema");    // Importamos el contrato

const router = express.Router();

router.get("/", verifyToken, checkModuleAccess("orders"), ctrl.list);
router.get("/:id", verifyToken, checkModuleAccess("orders"), ctrl.getById);

// Agregamos 'validate(orderCreateSchema)' antes del controlador
router.post("/", verifyToken, checkModuleAccess("orders"), validate(orderCreateSchema), ctrl.create);

router.patch("/:id", verifyToken, checkModuleAccess("orders"), ctrl.update);

module.exports = router;