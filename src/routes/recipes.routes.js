// src/routes/recipes.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/recipes.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/", verifyToken, ctrl.list);
router.get("/:productId", verifyToken, ctrl.getByProduct);
router.put("/", verifyToken, ctrl.upsert);
router.delete("/:productId", verifyToken, ctrl.remove);

module.exports = router;