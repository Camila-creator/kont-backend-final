// backend/routes/superadmin_dashboard.routes.js
const express = require('express');
const router = express.Router();
const saDashboardCtrl = require('../controllers/superadmin_dashboard.controller'); // Nombre nuevo
const { verifyToken } = require('../middlewares/auth.middleware');

router.get("/metrics", verifyToken, saDashboardCtrl.getMetrics);

module.exports = router;