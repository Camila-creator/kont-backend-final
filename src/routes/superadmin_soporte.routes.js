// backend/routes/superadmin_soporte.routes.js
const express = require('express');
const router = express.Router();
const soporteCtrl = require('../controllers/superadmin_soporte.controller');
const { verifyToken, checkModuleAccess } = require('../middlewares/auth.middleware');

// Traer la lista de tickets
router.get("/", verifyToken, checkModuleAccess("superadmin_soporte"), soporteCtrl.getTickets);

// Cambiar el estado de un ticket específico
router.put("/:id/status", verifyToken, checkModuleAccess("superadmin_soporte"), soporteCtrl.updateTicketStatus);

module.exports = router;