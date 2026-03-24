const routing = require("../models/finance_routing.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

exports.list = async (req, res) => { res.json(await routing.listRouting(getTenant(req))); };
exports.setMethodDefault = async (req, res) => {
  const method = (req.params.method || "").toString().trim().toUpperCase();
  const account_id = req.body?.account_id ?? null;
  const updated = await routing.setRouting(method, account_id, getTenant(req));
  if (!updated) return res.status(404).json({ error: "Método no existe" });
  res.json(updated);
};