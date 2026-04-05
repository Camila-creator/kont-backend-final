// src/controllers/reconciliation.controller.js
const model = require("../models/reconciliation.model");
const IS_PROD = process.env.NODE_ENV === "production";
const getTid = (req) => req.user.tenant_id || req.user.tenantId;

const handle = (err, res) => {
  const msg = err.message || "Error interno.";
  const isUser = ["obligatorio","no encontrado","cerrada","Quedan","inválido"].some(s => msg.includes(s));
  res.status(isUser ? 400 : 500).json({ ok: false, error: IS_PROD && !isUser ? "Error interno." : msg });
};

exports.list    = async (req, res) => { try { res.json({ ok: true, data: await model.listReconciliations(getTid(req)) }); } catch (e) { handle(e, res); } };

exports.getById = async (req, res) => { try {
  const r = await model.getReconciliationById(req.params.id, getTid(req));
  if (!r) return res.status(404).json({ ok: false, error: "Conciliación no encontrada." });
  res.json({ ok: true, data: r });
} catch (e) { handle(e, res); }};

exports.create  = async (req, res) => { try { res.status(201).json({ ok: true, data: await model.createReconciliation(req.body, getTid(req), req.user) }); } catch (e) { handle(e, res); }};
exports.importLines = async (req, res) => { try { res.json({ ok: true, data: await model.importStatementLines(req.params.id, req.body.lines, getTid(req), req.user) }); } catch (e) { handle(e, res); }};

exports.autoMatch   = async (req, res) => { try { res.json({ ok: true, data: await model.runAutoMatch(req.params.id, getTid(req)) }); } catch (e) { handle(e, res); }};

exports.matchManual = async (req, res) => { try {
  const { payment_id, payment_type, note } = req.body;
  res.json({ ok: true, data: await model.matchLineManual(req.params.lineId, payment_id, payment_type, note, getTid(req), req.user) });
} catch (e) { handle(e, res); }};

exports.ignoreLine  = async (req, res) => { try { res.json({ ok: true, data: await model.ignoreLine(req.params.lineId, req.body.note, getTid(req)) }); } catch (e) { handle(e, res); }};

exports.close       = async (req, res) => { try { res.json({ ok: true, data: await model.closeReconciliation(req.params.id, req.body.closing_balance, getTid(req), req.user) }); } catch (e) { handle(e, res); }};

exports.getPayments = async (req, res) => { try { res.json({ ok: true, data: await model.getAvailablePayments(req.params.id, getTid(req)) }); } catch (e) { handle(e, res); }};

 exports.revertLine = async (req, res) => {
  try {
     res.json({ ok: true, data: await model.revertLine(req.params.lineId, getTid(req)) });
   } catch (e) { handle(e, res); }
 };
