// src/routes/products.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/products.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); 
const { validate } = require("../middlewares/validator.middleware"); 
const { productSchema } = require("../schemas/product.schema"); 

router.get("/", verifyToken, ctrl.list);
router.get("/:id", verifyToken, ctrl.getById);

// Blindaje al crear un producto (evita precios negativos, etc)
router.post("/", verifyToken, validate(productSchema), ctrl.create);

// Blindaje al editar (si mandan precio, debe ser positivo)
router.put("/:id", verifyToken, validate(productSchema.partial()), ctrl.update);

router.delete("/:id", verifyToken, ctrl.remove);

module.exports = router;