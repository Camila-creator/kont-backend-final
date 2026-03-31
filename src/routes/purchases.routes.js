// src/routes/purchases.routes.js
const express = require("express");
const ctrl = require("../controllers/purchases.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); 
const { validate } = require("../middlewares/validator.middleware"); 
const { purchaseCreateSchema } = require("../schemas/purchases.schema"); 

const router = express.Router();

router.get("/", verifyToken, checkModuleAccess("purchases"), ctrl.list);
router.get("/:id", verifyToken,checkModuleAccess("purchases"), ctrl.getById);

// Triple blindaje para las compras
router.post("/", verifyToken, checkModuleAccess("purchases"), validate(purchaseCreateSchema), ctrl.create);

// Blindaje para actualizar estados de compras
router.patch("/:id", verifyToken, checkModuleAccess("purchases"), validate(purchaseCreateSchema.partial()), ctrl.update);

module.exports = router;