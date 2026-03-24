const InfModel = require("../models/mkt_influencers.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

async function list(req, res, next) { try { res.json({ success: true, data: await InfModel.getAll(getTenant(req)) }); } catch (e) { next(e); } }
async function add(req, res, next) { try { res.json({ success: true, data: await InfModel.create(req.body, getTenant(req)) }); } catch (e) { next(e); } }
async function edit(req, res, next) { try { res.json({ success: true, data: await InfModel.update(req.params.id, req.body, getTenant(req)) }); } catch (e) { next(e); } }
module.exports = { list, add, edit };