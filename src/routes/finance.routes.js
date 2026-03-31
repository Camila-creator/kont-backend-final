const router = require("express").Router();

const banksCtrl = require("../controllers/finance_banks.controller");
const accountsCtrl = require("../controllers/finance_accounts.controller");
const routingCtrl = require("../controllers/finance_routing.controller");

// IMPORTAMOS EL NUEVO CONTROLADOR DE DASHBOARD
const dashboardCtrl = require("../controllers/finance_dashboard.controller"); 
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware"); // 👮‍♂️ El Guardia

// BANKS
router.get("/banks",verifyToken, checkModuleAccess("finance_banks"), banksCtrl.list);
router.post("/banks",verifyToken, checkModuleAccess("finance_banks"), banksCtrl.create);
router.put("/banks/:id", verifyToken, checkModuleAccess("finance_banks"), banksCtrl.update);
router.delete("/banks/:id", verifyToken, checkModuleAccess("finance_banks"), banksCtrl.remove);

// ACCOUNTS
router.get("/accounts",verifyToken, checkModuleAccess("finance_accounts"), accountsCtrl.list);
router.post("/accounts",verifyToken, checkModuleAccess("finance_accounts"), accountsCtrl.create);
router.put("/accounts/:id", verifyToken, checkModuleAccess("finance_accounts"), accountsCtrl.update);
router.delete("/accounts/:id", verifyToken, checkModuleAccess("finance_accounts"), accountsCtrl.remove);

// METHOD ROUTING
router.get("/method-routing",verifyToken, checkModuleAccess("finance_routing"), routingCtrl.list);
router.put("/method-routing/:method",verifyToken, checkModuleAccess("finance_routing"), routingCtrl.setMethodDefault);

// --- LA NUEVA RUTA MAESTRA ---
router.get("/dashboard",verifyToken, checkModuleAccess("finance_dashboard"), dashboardCtrl.getDashboard); // Cambio /stats a /dashboard

module.exports = router;