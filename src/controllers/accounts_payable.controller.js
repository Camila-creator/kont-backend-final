const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const apModel = require("../models/accounts_payable.model");

const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

exports.summary = asyncHandler(async (req, res) => {
  const tenantId = getTenant(req);
  
  // Validamos que exista un tenantId antes de consultar
  if (!tenantId) {
    return res.status(403).json({ error: "Sesión inválida: No se detectó Tenant ID" });
  }

  const data = await apModel.listAPSummary(tenantId);
  return ok(res, data);
});