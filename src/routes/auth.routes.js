// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

// POST /api/auth/login
router.post("/login", authController.login);

// POST /api/auth/refresh — Renovar access token con el refresh token
router.post("/refresh", authController.refreshToken);

module.exports = router;
