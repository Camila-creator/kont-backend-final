// src/routes/customers.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/customers.controller");
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia
const { validate } = require("../middlewares/validator.middleware"); // 🛡️ El Escudo
const { customerSchema } = require("../schemas/customer.schema"); // 📝 El Contrato

router.get("/", verifyToken, ctrl.list);
router.get("/:id", verifyToken, ctrl.getById);

// Protegemos la creación exigiendo todo el esquema
router.post("/", verifyToken, validate(customerSchema), ctrl.create);

// Protegemos la edición (.partial() permite enviar solo los campos a cambiar)
router.put("/:id", verifyToken, validate(customerSchema.partial()), ctrl.update);

router.delete("/:id", verifyToken, ctrl.remove);

module.exports = router;