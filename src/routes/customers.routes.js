// src/routes/customers.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/customers.controller");
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia
const { validate } = require("../middlewares/validator.middleware"); // 🛡️ El Escudo
const { customerSchema } = require("../schemas/customer.schema"); // 📝 El Contrato

router.get("/", verifyToken, checkModuleAccess("customers"), ctrl.list);
router.get("/:id", verifyToken, checkModuleAccess("customers"), ctrl.getById);

// Protegemos la creación exigiendo todo el esquema
router.post("/", verifyToken, checkModuleAccess("customers"), validate(customerSchema), ctrl.create);

// Protegemos la edición (.partial() permite enviar solo los campos a cambiar)
router.put("/:id", verifyToken, checkModuleAccess("customers"), validate(customerSchema.partial()), ctrl.update);

router.delete("/:id", verifyToken, checkModuleAccess("customers"), ctrl.remove);

module.exports = router;