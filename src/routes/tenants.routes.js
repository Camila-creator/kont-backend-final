// backend/routes/tenants.routes.js
const express = require("express");
const router = express.Router();
const tenantsController = require("../controllers/tenants.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");

// Todas las rutas están protegidas por el guardia (verifyToken)
router.get("/", verifyToken, checkModuleAccess("tenants"), tenantsController.getTenants);
router.post("/", verifyToken, checkModuleAccess("tenants"), tenantsController.createTenant);
router.put("/:id", verifyToken, checkModuleAccess("tenants"), tenantsController.updateTenant);
router.put("/:id/status", verifyToken, checkModuleAccess("tenants"), tenantsController.toggleTenantStatus);

module.exports = router;