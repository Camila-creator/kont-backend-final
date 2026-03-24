const router = require("express").Router();
const ctrl = require("../controllers/productions.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/", verifyToken, ctrl.list);
router.get("/preview", verifyToken, ctrl.preview);
router.post("/", verifyToken, ctrl.create);

module.exports = router;