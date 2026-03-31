const express = require("express");
const router = express.Router();
const exchangeController = require("../controllers/exchange.controller");

// DESESTRUCTURAR la función del objeto importado
const { verifyToken,checkModuleAccess } = require("../middlewares/auth.middleware"); 

// USAR la función desestructurada
router.use(verifyToken);

router.get("/",checkModuleAccess("exchange"), exchangeController.getRates);
router.post("/",checkModuleAccess("exchange"), exchangeController.updateRate);

module.exports = router;