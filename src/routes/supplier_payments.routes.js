const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/supplier_payments.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/",verifyToken,checkModuleAccess("supplier_payments"), ctrl.list);
router.post("/", verifyToken, checkModuleAccess("supplier_payments"), ctrl.create);

module.exports = router;