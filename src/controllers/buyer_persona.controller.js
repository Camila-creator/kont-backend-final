const BuyerModel = require("../models/buyer_persona.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

async function getPersonas(req, res, next) { try { res.json({ success: true, data: await BuyerModel.getAll(getTenant(req)) }); } catch (error) { next(error); } }
async function createPersona(req, res, next) {
    try { req.body.tenant_id = getTenant(req); res.json({ success: true, data: await BuyerModel.create(req.body) }); } catch (error) { next(error); }
}
async function updatePersona(req, res, next) {
    try { res.json({ success: true, data: await BuyerModel.update(req.params.id, req.body, getTenant(req)) }); } catch (error) { next(error); }
}
module.exports = { getPersonas, createPersona, updatePersona };