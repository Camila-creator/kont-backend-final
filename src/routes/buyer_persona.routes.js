const { Router } = require("express");
const controller = require("../controllers/buyer_persona.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

const router = Router();

router.get("/",verifyToken, controller.getPersonas);
router.post("/",verifyToken, controller.createPersona); // Ruta POST para crear
router.put("/:id", verifyToken, controller.updatePersona); // Ruta PUT para editar

module.exports = router; 