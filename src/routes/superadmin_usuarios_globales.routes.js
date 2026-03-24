// backend/routes/superadmin_usuarios_globales.routes.js
const express = require('express');
const router = express.Router();
const globalUsersCtrl = require('../controllers/superadmin_usuarios_globales.controller');
const { verifyToken } = require('../middlewares/auth.middleware'); 

// 1. Ruta para ver el resumen de todas las empresas (Las Cajitas)
router.get("/summary", verifyToken, globalUsersCtrl.getTenantsSummary);

// 2. Ruta para ver la lista de empleados (El Modal Espía)
router.get("/:id/users", verifyToken, globalUsersCtrl.getTenantUsers);

module.exports = router; 