const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/supplier_payments.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/",verifyToken, ctrl.list);
router.post("/", verifyToken, ctrl.create);

module.exports = router;