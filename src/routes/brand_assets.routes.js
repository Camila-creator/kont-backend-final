// backend/src/routes/brand_assets.routes.js
const { Router } = require("express");
const controller = require("../controllers/brand_assets.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

router.get("/",verifyToken, controller.getBrandBook);
router.put("/", verifyToken, controller.updateAsset); // <--- Esta línea es vital

module.exports = router;