// backend/routes/superadmin_reportes.routes.js
const express = require('express');
const router = express.Router();
const reportesCtrl = require('../controllers/superadmin_reportes.controller');
const { verifyToken } = require('../middlewares/auth.middleware'); 

// Ruta para obtener el ranking de uso de las empresas
router.get("/usage", verifyToken, reportesCtrl.getUsageReports);

module.exports = router; 