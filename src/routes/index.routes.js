// backend/routes/index.routes.js

const router = require("express").Router();

// Ruta de autenticacion
const authRoutes = require("./auth.routes");

// Ruta de usuarios (CRUD)
const usersRoutes = require("./users.routes");

// Ruta de auditoria 
const auditRoutes = require("./audit.routes");

// Ruta de facturacion 
const invoicesRoutes = require("./invoices.routes");

// 🔔 NUEVA RUTA: Sistema de Alertas y Notificaciones
const alertRoutes = require("./alerts.routes");

// Rutas de kont intelligence
const intelligenceRoutes = require("./intelligence.routes");

// Rutas de superadmin 

const tenantsRoutes = require("./tenants.routes");
const usuariosGlobalesRoutes = require("./superadmin_usuarios_globales.routes");
const reportesGlobalesRoutes = require("./superadmin_reportes.routes");
const soporteGlobalRoutes = require("./superadmin_soporte.routes");
const supportTicketsRoutes = require("./support_tickets.routes");
const saDashboardRoutes = require("./superadmin_dashboard.routes");


const healthRoutes = require("./health.routes");
const suppliersRoutes = require("./suppliers.routes");
const supplyCategoriesRoutes = require("./supply_categories.routes");
const productsRoutes = require("./products.routes");
const suppliesRoutes = require("./supplies.routes");
const recipesRoutes = require("./recipes.routes");
const productionsRoutes = require("./productions.routes");
const customersRoutes = require("./customers.routes");
const ordersRoutes = require("./orders.routes");
const purchasesRoutes = require("./purchases.routes");

// 👇 ESTOS DOS son los nuevos (según tu screenshot)
const accountsPayableRoutes = require("./accounts_payable.routes");
const supplierPaymentsRoutes = require("./supplier_payments.routes");

// 👇 nuevos
const accountsReceivableRoutes = require("./accounts_receivable.routes");
const customerPaymentsRoutes = require("./customer_payments.routes");

const cxcRoutes = require("./cxc.routes");

const financeRoutes = require("./finance.routes");

// RUTAS DE SUCURSALES
const branchesRoutes = require("./branches.routes");

// 🔔 MONTAJE DE ALERTAS
router.use("/alerts", alertRoutes);
// Ruta de Egresos (Gastos Fijos y Esporádicos)
const expensesRoutes = require("./expenses.routes");

const cajaRoutes = require("./caja.routes");

// marketing routes 
const brandAssetsRoutes = require("./brand_assets.routes");
const buyerPersonaRoutes = require("./buyer_persona.routes");
const mktCalendarRoutes = require("./mkt_calendar.routes");
const adsRoutes = require("./mkt_ads.routes");
const offlineRoutes = require("./mkt_offline.routes");
const influencersRoutes = require("./mkt_influencers.routes");
const tasksRoutes = require("./mkt_tasks.routes"); 
const resultsRoutes = require("./mkt_results.routes");

//dashboards routes 

const dashboardMainRoutes = require("./dashboard_main.routes");
const exchangeRoutes = require("./exchange.routes");

// RUTAS DE SERIALES (IMEIS TELEFONOS)
const serialRoutes = require("./serial_routes");
// RUTA: Equipos recibidos como pago (El "limbo")
const receivedPhonesRoutes = require("./received-phones.routes"); 

// RUTAS DE NOMINA Y CONCILIACION 
const payrollRoutes        = require("./payroll.routes");
const reconciliationRoutes = require("./reconciliation.routes");


router.use("/", healthRoutes);

router.use("/suppliers", suppliersRoutes);
router.use("/products", productsRoutes);
router.use("/supplies", suppliesRoutes);
router.use("/supply-categories", supplyCategoriesRoutes);
router.use("/recipes", recipesRoutes);
router.use("/production", productionsRoutes);

router.use("/customers", customersRoutes);
router.use("/orders", ordersRoutes);
router.use("/purchases", purchasesRoutes);

// 👇 monta los nuevos
router.use("/accounts-payable", accountsPayableRoutes);
router.use("/supplier-payments", supplierPaymentsRoutes);

router.use("/accounts-receivable", accountsReceivableRoutes);
router.use("/customer-payments", customerPaymentsRoutes);

router.use("/cxc", cxcRoutes);

router.use("/finance", financeRoutes);
router.use("/caja", cajaRoutes);

//marketing routes 
router.use("/brand-assets", brandAssetsRoutes);
router.use("/buyer-personas", buyerPersonaRoutes);
router.use("/mkt-calendar", mktCalendarRoutes);
router.use("/mkt-ads", adsRoutes);
router.use("/mkt-offline", offlineRoutes);
router.use("/mkt-influencers", influencersRoutes);
router.use("/mkt-tasks", tasksRoutes);
router.use("/mkt-results", resultsRoutes);

//dashboards routes  

router.use("/dashboard-main", dashboardMainRoutes);
router.use("/exchange", exchangeRoutes);


// RUTA DE AUTENTICACION (LOGIN)
router.use("/auth", authRoutes);

// RUTA DE USUARIOS (CRUD)
router.use("/users", usersRoutes);

// RUTA DE AUDITORIA
router.use("/audit", auditRoutes);

// RUTA DE FACTURACION
router.use("/invoices", invoicesRoutes);

// RUTA DE EGRESOS (GASTOS)
router.use("/expenses", expensesRoutes);

// RUTAS DE SUPER ADMIN 

router.use("/tenants", tenantsRoutes);
router.use("/usuarios-globales", usuariosGlobalesRoutes);
router.use("/reportes-globales", reportesGlobalesRoutes);
router.use("/soporte-global", soporteGlobalRoutes);
router.use("/support-tickets", supportTicketsRoutes);
router.use("/sa-dashboard", saDashboardRoutes);


// RUTAS DE SERIALES (IMEIS) 
router.use("/serials", serialRoutes);
router.use("/received-phones", receivedPhonesRoutes);

// RUTAS DE SUCURSALES 
router.use("/branches", branchesRoutes);

// RUTAS DE KONT INTELLIGENCE
router.use("/intelligence", intelligenceRoutes);

// RUTAS DE NOMINA Y CONCILIACION
router.use("/payroll",          payrollRoutes);
router.use("/reconciliations",  reconciliationRoutes);

module.exports = router;