const router = require("express").Router();
const ctrl = require("../controllers/productions.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/", verifyToken, checkModuleAccess("productions"), ctrl.list);
router.get("/preview", verifyToken, checkModuleAccess("productions"), ctrl.preview);
router.post("/", verifyToken, checkModuleAccess("productions"), ctrl.create);

module.exports = router;