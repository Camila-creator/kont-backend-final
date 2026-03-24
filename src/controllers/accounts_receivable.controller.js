const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const arModel = require("../models/accounts_receivable.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

exports.summary = asyncHandler(async (req, res) => {
  const data = await arModel.listARSummary(getTenant(req));
  return ok(res, data);
});