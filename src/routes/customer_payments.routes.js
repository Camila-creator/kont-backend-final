// src/routes/customer_payments.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/customer_payments.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

router.get("/",verifyToken, ctrl.list);
router.post("/",verifyToken, ctrl.create);
router.delete("/:id", verifyToken, ctrl.remove); // 👈 nuevo

module.exports = router;