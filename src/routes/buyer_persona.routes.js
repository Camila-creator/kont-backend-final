const { Router } = require("express");
const controller = require("../controllers/buyer_persona.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

router.get("/",verifyToken, checkModuleAccess("buyer_personas"), controller.getPersonas);
router.post("/",verifyToken, checkModuleAccess("buyer_personas"), controller.createPersona); // Ruta POST para crear
router.put("/:id", verifyToken, checkModuleAccess("buyer_personas"), controller.updatePersona); // Ruta PUT para editar

module.exports = router; 