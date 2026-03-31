// src/routes/customer_payments.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/customer_payments.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/",verifyToken, checkModuleAccess("customer_payments"), ctrl.list);
router.post("/",verifyToken, checkModuleAccess("customer_payments"), ctrl.create);
router.delete("/:id", verifyToken, checkModuleAccess("customer_payments"), ctrl.remove); // 👈 nuevo

module.exports = router;