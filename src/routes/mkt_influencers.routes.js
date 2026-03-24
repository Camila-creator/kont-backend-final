const { Router } = require("express");
const ctrl = require("../controllers/mkt_influencers.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia
const router = Router();
router.get("/",verifyToken, ctrl.list);
router.post("/",verifyToken, ctrl.add);
router.put("/:id",verifyToken, ctrl.edit);
module.exports = router;