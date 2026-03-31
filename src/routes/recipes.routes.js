// src/routes/recipes.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/recipes.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/", verifyToken, checkModuleAccess("recipes"), ctrl.list);
router.get("/:productId", verifyToken, checkModuleAccess("recipes"), ctrl.getByProduct);
router.put("/", verifyToken, checkModuleAccess("recipes"), ctrl.upsert);
router.delete("/:productId", verifyToken, checkModuleAccess("recipes"), ctrl.remove);

module.exports = router;