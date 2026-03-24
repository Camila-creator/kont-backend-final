const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/invoices.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Cuando le das al botón "Generar" en el frontend
router.post("/", verifyToken, ctrl.create);

module.exports = router;