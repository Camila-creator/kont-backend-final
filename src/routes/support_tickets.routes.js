// backend/routes/support_tickets.routes.js
const express = require('express');
const router = express.Router();
const supportCtrl = require('../controllers/support_tickets.controller');
const { verifyToken, checkModuleAccess } = require('../middlewares/auth.middleware');

// El usuario pide ver sus propios tickets
router.get("/", verifyToken, checkModuleAccess("support_tickets"), supportCtrl.getMyTickets);

// El usuario envía un nuevo ticket
router.post("/", verifyToken, checkModuleAccess("support_tickets"), supportCtrl.createTicket);

module.exports = router;