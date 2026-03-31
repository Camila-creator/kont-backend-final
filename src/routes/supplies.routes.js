const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/supplies.controller");
// 1. Traemos al guardia
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");

// 2. Lo ponemos en medio de TODAS las puertas
router.get("/", verifyToken, checkModuleAccess("supplies"), ctrl.list);
router.get("/:id", verifyToken, checkModuleAccess("supplies"), ctrl.getById);
router.post("/", verifyToken, checkModuleAccess("supplies"), ctrl.create);
router.put("/:id", verifyToken, checkModuleAccess("supplies"), ctrl.update);
router.delete("/:id", verifyToken, checkModuleAccess("supplies"), ctrl.remove);

module.exports = router;
