const express = require("express");
const router = express.Router();
const exchangeController = require("../controllers/exchange.controller");

// DESESTRUCTURAR la función del objeto importado
const { verifyToken } = require("../middlewares/auth.middleware"); 

// USAR la función desestructurada
router.use(verifyToken);

router.get("/", exchangeController.getRates);
router.post("/", exchangeController.updateRate);

module.exports = router;