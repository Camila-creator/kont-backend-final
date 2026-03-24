const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/supplies.controller");
// 1. Traemos al guardia
const { verifyToken } = require("../middlewares/auth.middleware");

// 2. Lo ponemos en medio de TODAS las puertas
router.get("/", verifyToken, ctrl.list);
router.get("/:id", verifyToken, ctrl.getById);
router.post("/", verifyToken, ctrl.create);
router.put("/:id", verifyToken, ctrl.update);
router.delete("/:id", verifyToken, ctrl.remove);

module.exports = router;
