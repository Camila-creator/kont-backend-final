// backend/routes/users.routes.js
const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");

// Todas estas rutas están protegidas por el Guardia (verifyToken)
router.get("/", verifyToken, checkModuleAccess("users"), usersController.getUsers);
router.post("/", verifyToken, checkModuleAccess("users"), usersController.createUser);
router.put("/:id", verifyToken, checkModuleAccess("users"), usersController.updateUser);

module.exports = router;