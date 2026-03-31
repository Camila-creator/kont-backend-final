// backend/routes/superadmin_dashboard.routes.js
const express = require('express');
const router = express.Router();
const saDashboardCtrl = require('../controllers/superadmin_dashboard.controller'); // Nombre nuevo
const { verifyToken, checkModuleAccess } = require('../middlewares/auth.middleware');

router.get("/metrics", verifyToken, checkModuleAccess("superadmin_dashboard"), saDashboardCtrl.getMetrics);

module.exports = router;