// backend/routes/orders.routes.js
const express = require("express");
const ctrl = require("../controllers/orders.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validator.middleware"); // Importamos el escudo
const { orderCreateSchema } = require("../schemas/order.schema");    // Importamos el contrato

const router = express.Router();

router.get("/", verifyToken, ctrl.list);
router.get("/:id", verifyToken, ctrl.getById);

// Agregamos 'validate(orderCreateSchema)' antes del controlador
router.post("/", verifyToken, validate(orderCreateSchema), ctrl.create);

router.patch("/:id", verifyToken, ctrl.update);

module.exports = router;