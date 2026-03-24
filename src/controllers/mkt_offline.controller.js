const OfflineModel = require("../models/mkt_offline.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

async function listActivities(req, res, next) { try { res.json({ success: true, data: await OfflineModel.getAllActivities(getTenant(req)) }); } catch (error) { next(error); } }
async function addActivity(req, res, next) { try { res.json({ success: true, data: await OfflineModel.createActivity(req.body, getTenant(req)) }); } catch (error) { next(error); } }
async function editActivity(req, res, next) { try { res.json({ success: true, data: await OfflineModel.updateActivity(req.params.id, req.body, getTenant(req)) }); } catch (error) { next(error); } }
module.exports = { listActivities, addActivity, editActivity };