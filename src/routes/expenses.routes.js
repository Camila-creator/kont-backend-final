const router = require("express").Router();
const ctrl = require("../controllers/expenses_controller"); // El que creamos antes
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

// Rutas de Gestión de Egresos
router.get("/", verifyToken, ctrl.getExpenses);
router.post("/", verifyToken, ctrl.createExpense);
router.delete("/:id", verifyToken, ctrl.deleteExpense);

module.exports = router;