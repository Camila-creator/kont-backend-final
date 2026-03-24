const router = require("express").Router();

const banksCtrl = require("../controllers/finance_banks.controller");
const accountsCtrl = require("../controllers/finance_accounts.controller");
const routingCtrl = require("../controllers/finance_routing.controller");

// IMPORTAMOS EL NUEVO CONTROLADOR DE DASHBOARD
const dashboardCtrl = require("../controllers/finance_dashboard.controller"); 
const { verifyToken } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

// BANKS
router.get("/banks",verifyToken, banksCtrl.list);
router.post("/banks",verifyToken, banksCtrl.create);
router.put("/banks/:id", verifyToken, banksCtrl.update);
router.delete("/banks/:id", verifyToken, banksCtrl.remove);

// ACCOUNTS
router.get("/accounts",verifyToken, accountsCtrl.list);
router.post("/accounts",verifyToken, accountsCtrl.create);
router.put("/accounts/:id", verifyToken, accountsCtrl.update);
router.delete("/accounts/:id", verifyToken, accountsCtrl.remove);

// METHOD ROUTING
router.get("/method-routing",verifyToken, routingCtrl.list);
router.put("/method-routing/:method",verifyToken, routingCtrl.setMethodDefault);

// --- LA NUEVA RUTA MAESTRA ---
router.get("/dashboard",verifyToken, dashboardCtrl.getDashboard); // Cambio /stats a /dashboard

module.exports = router;