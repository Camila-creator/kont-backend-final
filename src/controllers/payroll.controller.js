// src/controllers/payroll.controller.js
const model = require("../models/payroll.model");
const IS_PROD = process.env.NODE_ENV === "production";
const getTid = (req) => req.user.tenant_id || req.user.tenantId;

const handle = (err, res) => {
  const msg = err.message || "Error interno.";
  const isUserErr = ["obligatorio","no encontrado","ya está cerrado","Sin campos"].some(s => msg.includes(s));
  res.status(isUserErr ? 400 : 500).json({ ok: false, error: IS_PROD && !isUserErr ? "Error interno." : msg });
};

// ── Empleados ──────────────────────────────────────────────────────
exports.listEmployees = async (req, res) => {
  try {
    res.json({ ok: true, data: await model.listEmployees(getTid(req)) });
  } catch (e) { handle(e, res); }
};

exports.getEmployee = async (req, res) => {
  try {
    const emp = await model.getEmployeeById(req.params.id, getTid(req));
    if (!emp) return res.status(404).json({ ok: false, error: "Empleado no encontrado." });
    res.json({ ok: true, data: emp });
  } catch (e) { handle(e, res); }
};

exports.createEmployee = async (req, res) => {
  try {
    const emp = await model.createEmployee(req.body, getTid(req), req.user);
    res.status(201).json({ ok: true, data: emp });
  } catch (e) { handle(e, res); }
};

exports.updateEmployee = async (req, res) => {
  try {
    const emp = await model.updateEmployee(req.params.id, req.body, getTid(req), req.user);
    res.json({ ok: true, data: emp });
  } catch (e) { handle(e, res); }
};

// ── Períodos ──────────────────────────────────────────────────────
exports.listPeriods = async (req, res) => {
  try {
    res.json({ ok: true, data: await model.listPeriods(getTid(req)) });
  } catch (e) { handle(e, res); }
};

exports.getPeriod = async (req, res) => {
  try {
    const period = await model.getPeriodById(req.params.id, getTid(req));
    if (!period) return res.status(404).json({ ok: false, error: "Período no encontrado." });
    res.json({ ok: true, data: period });
  } catch (e) { handle(e, res); }
};

exports.createPeriod = async (req, res) => {
  try {
    const period = await model.createPeriod(req.body, getTid(req), req.user);
    res.status(201).json({ ok: true, data: period });
  } catch (e) { handle(e, res); }
};

exports.closePeriod = async (req, res) => {
  try {
    const period = await model.closePeriod(req.params.id, getTid(req), req.user);
    res.json({ ok: true, data: period });
  } catch (e) { handle(e, res); }
};

// ── Items individuales ─────────────────────────────────────────────
exports.updateItem = async (req, res) => {
  try {
    const item = await model.updatePayrollItem(req.params.id, req.body, getTid(req), req.user);
    res.json({ ok: true, data: item });
  } catch (e) { handle(e, res); }
};

// ── Tasas legales para el frontend ────────────────────────────────
exports.getRates = async (req, res) => {
  res.json({ ok: true, data: model.VE_RATES });
};
