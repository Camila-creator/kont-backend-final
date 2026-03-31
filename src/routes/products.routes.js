// src/routes/products.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/products.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); 
const { validate } = require("../middlewares/validator.middleware"); 
const { productSchema } = require("../schemas/product.schema"); 

router.get("/", verifyToken, checkModuleAccess("products"), ctrl.list);
router.get("/:id", verifyToken, checkModuleAccess("products"), ctrl.getById);

// Blindaje al crear un producto (evita precios negativos, etc)
router.post("/", verifyToken, checkModuleAccess("products"), validate(productSchema), ctrl.create);

// Blindaje al editar (si mandan precio, debe ser positivo)
router.put("/:id", verifyToken, checkModuleAccess("products"), validate(productSchema.partial()), ctrl.update);

router.delete("/:id", verifyToken, checkModuleAccess("products"), ctrl.remove);

module.exports = router;