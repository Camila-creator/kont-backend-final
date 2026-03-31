const express = require("express");
const ctrl = require("../controllers/supply_categories.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");

const router = express.Router();

// Rutas protegidas por token
router.get("/", verifyToken, checkModuleAccess("supply_categories"), ctrl.list);
router.post("/", verifyToken, checkModuleAccess("supply_categories"), ctrl.create);
router.delete("/:id", verifyToken, checkModuleAccess("supply_categories"), ctrl.remove);

module.exports = router;