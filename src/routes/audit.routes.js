const express = require("express");
const router = express.Router();
const auditController = require("../controllers/audit.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware");

// GET: Para ver la tabla en el frontend (Protegida)
router.get("/", verifyToken, checkModuleAccess("audit"), auditController.getAuditLogs);

// POST: Para que el main.js mande los logs (Protegida)
router.post("/save", verifyToken, checkModuleAccess("audit"), auditController.saveAuditLog);

module.exports = router;