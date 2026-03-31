const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/accounts_payable.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/summary", verifyToken, checkModuleAccess("finance"), ctrl.summary);

module.exports = router;