// backend/routes/users.routes.js
const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Todas estas rutas están protegidas por el Guardia (verifyToken)
router.get("/", verifyToken, usersController.getUsers);
router.post("/", verifyToken, usersController.createUser);
router.put("/:id", verifyToken, usersController.updateUser);

module.exports = router;