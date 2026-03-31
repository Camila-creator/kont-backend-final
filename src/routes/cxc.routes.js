// backend/routes/cxc.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/cxc.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/",verifyToken, checkModuleAccess("cxc"), ctrl.summary);


module.exports = router;