// src/controllers/credit_notes.controller.js
const model  = require("../models/credit_notes.model");
const IS_PROD = process.env.NODE_ENV === "production";
const getTid  = r => r.user.tenant_id || r.user.tenantId;

const handle = (err, res) => {
  const msg = err.message || "";
  const isUser = ["obligatorio","no encontrado","Solo se pueden","más de","ya existe","no pertenece","ya está anulada","ya fue revertido"].some(s => msg.includes(s));
  res.status(isUser ? 400 : 500).json({ ok: false, error: IS_PROD && !isUser ? "Error interno." : msg });
};

exports.list     = async (req, res) => { try { res.json({ ok:true, data: await model.listCreditNotes(getTid(req), req.query) }); } catch(e){ handle(e,res); }};

exports.getById  = async (req, res) => { try {
  const cn = await model.getCreditNoteById(req.params.id, getTid(req));
  if (!cn) return res.status(404).json({ ok:false, error:"Nota de crédito no encontrada." });
  res.json({ ok:true, data:cn });
} catch(e){ handle(e,res); }};

exports.create   = async (req, res) => { try { res.status(201).json({ ok:true, data: await model.createCreditNote(req.body, getTid(req), req.user) }); } catch(e){ handle(e,res); }};

exports.cancel   = async (req, res) => { try { res.json({ ok:true, data: await model.cancelCreditNote(req.params.id, getTid(req), req.user) }); } catch(e){ handle(e,res); }};
