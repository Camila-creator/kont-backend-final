// src/routes/suppliers.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/suppliers.controller");

// 1. ¡IMPORTANTE! Importamos al Guardia de Seguridad
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); 

// 2. Ponemos al guardia (verifyToken) en el medio de TODAS las rutas
router.get("/", verifyToken, checkModuleAccess("suppliers"), ctrl.list);
router.get("/:id", verifyToken, checkModuleAccess("suppliers"), ctrl.getById);
router.post("/", verifyToken, checkModuleAccess("suppliers"), ctrl.create);
router.put("/:id", verifyToken, checkModuleAccess("suppliers"), ctrl.update);
router.delete("/:id", verifyToken, checkModuleAccess("suppliers"), ctrl.remove);

module.exports = router;