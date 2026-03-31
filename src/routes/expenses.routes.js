const router = require("express").Router();
const ctrl = require("../controllers/expenses.controller"); // El que creamos antes
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

// Rutas de Gestión de Egresos
router.get("/", verifyToken, checkModuleAccess("expenses"), ctrl.getExpenses);
router.post("/", verifyToken, checkModuleAccess("expenses"), ctrl.createExpense);
router.delete("/:id", verifyToken, checkModuleAccess("expenses"), ctrl.deleteExpense);

module.exports = router;