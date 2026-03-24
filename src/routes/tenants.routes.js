// backend/routes/tenants.routes.js
const express = require("express");
const router = express.Router();
const tenantsController = require("../controllers/tenants.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Todas las rutas están protegidas por el guardia (verifyToken)
router.get("/", verifyToken, tenantsController.getTenants);
router.post("/", verifyToken, tenantsController.createTenant);
router.put("/:id", verifyToken, tenantsController.updateTenant);
router.put("/:id/status", verifyToken, tenantsController.toggleTenantStatus);

module.exports = router;