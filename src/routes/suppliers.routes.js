// src/routes/suppliers.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/suppliers.controller");

// 1. ¡IMPORTANTE! Importamos al Guardia de Seguridad
const { verifyToken } = require("../middlewares/auth.middleware"); 

// 2. Ponemos al guardia (verifyToken) en el medio de TODAS las rutas
router.get("/", verifyToken, ctrl.list);
router.get("/:id", verifyToken, ctrl.getById);
router.post("/", verifyToken, ctrl.create);
router.put("/:id", verifyToken, ctrl.update);
router.delete("/:id", verifyToken, ctrl.remove);

module.exports = router;