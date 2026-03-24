const { Router } = require("express");
const ctrl = require("../controllers/mkt_tasks.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia
const router = Router();

// Rutas de Roles
router.get("/roles",verifyToken, ctrl.getRoles);
router.post("/roles",verifyToken, ctrl.addRole);
router.delete("/roles/:id",verifyToken, ctrl.removeRole);

// Rutas de Tareas
router.get("/",verifyToken, ctrl.getTasks);
router.post("/",verifyToken, ctrl.addTask);
router.put("/:id",verifyToken, ctrl.editTask);

module.exports = router;