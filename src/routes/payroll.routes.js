// src/routes/payroll.routes.js
const router = require("express").Router();
const ctrl   = require("../controllers/payroll.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");
const auth = [verifyToken, checkModuleAccess("payroll")];

// Empleados
router.get("/employees",          ...auth, ctrl.listEmployees);
router.get("/employees/:id",      ...auth, ctrl.getEmployee);
router.post("/employees",         ...auth, ctrl.createEmployee);
router.put("/employees/:id",      ...auth, ctrl.updateEmployee);

// Períodos
router.get("/periods",            ...auth, ctrl.listPeriods);
router.get("/periods/:id",        ...auth, ctrl.getPeriod);
router.post("/periods",           ...auth, ctrl.createPeriod);
router.post("/periods/:id/close", ...auth, ctrl.closePeriod);

// Items individuales (novedades)
router.put("/items/:id",          ...auth, ctrl.updateItem);

// Utilidades
router.get("/rates",              ...auth, ctrl.getRates);

module.exports = router;