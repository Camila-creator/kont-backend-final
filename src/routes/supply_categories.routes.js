const express = require("express");
const ctrl = require("../controllers/supply_categories.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

// Rutas protegidas por token
router.get("/", verifyToken, ctrl.list);
router.post("/", verifyToken, ctrl.create);
router.delete("/:id", verifyToken, ctrl.remove);

module.exports = router;