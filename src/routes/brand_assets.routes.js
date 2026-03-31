// backend/src/routes/brand_assets.routes.js
const { Router } = require("express");
const controller = require("../controllers/brand_assets.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

router.get("/",verifyToken, checkModuleAccess("brand_assets"), controller.getBrandBook);
router.put("/", verifyToken, checkModuleAccess("brand_assets"), controller.updateAsset); // <--- Esta línea es vital

module.exports = router;