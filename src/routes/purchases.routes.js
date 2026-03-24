// src/routes/purchases.routes.js
const express = require("express");
const ctrl = require("../controllers/purchases.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); 
const { validate } = require("../middlewares/validator.middleware"); 
const { purchaseCreateSchema } = require("../schemas/purchases.schema"); 

const router = express.Router();

router.get("/", verifyToken, ctrl.list);
router.get("/:id", verifyToken, ctrl.getById);

// Triple blindaje para las compras
router.post("/", verifyToken, validate(purchaseCreateSchema), ctrl.create);

// Blindaje para actualizar estados de compras
router.patch("/:id", verifyToken, validate(purchaseCreateSchema.partial()), ctrl.update);

module.exports = router;