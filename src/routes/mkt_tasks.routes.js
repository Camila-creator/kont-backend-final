const { Router } = require("express");
const ctrl = require("../controllers/mkt_tasks.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia
const router = Router();

// Rutas de Roles
router.get("/roles",verifyToken, checkModuleAccess("mkt_tasks"), ctrl.getRoles);
router.post("/roles",verifyToken, checkModuleAccess("mkt_tasks"), ctrl.addRole);
router.delete("/roles/:id",verifyToken, checkModuleAccess("mkt_tasks"), ctrl.removeRole);

// Rutas de Tareas
router.get("/",verifyToken, checkModuleAccess("mkt_tasks"), ctrl.getTasks);
router.post("/",verifyToken, checkModuleAccess("mkt_tasks"), ctrl.addTask);
router.put("/:id",verifyToken, checkModuleAccess("mkt_tasks"), ctrl.editTask);

module.exports = router;