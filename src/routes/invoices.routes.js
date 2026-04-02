// src/routes/invoices.routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/invoices.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");

router.get("/",    verifyToken, checkModuleAccess("invoices"), ctrl.list);
router.get("/:id", verifyToken, checkModuleAccess("invoices"), ctrl.getById);
router.post("/",   verifyToken, checkModuleAccess("invoices"), ctrl.create);

module.exports = router;