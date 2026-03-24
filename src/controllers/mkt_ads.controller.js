const AdsModel = require("../models/mkt_ads.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

async function listAudiences(req, res, next) { try { res.json({ success: true, data: await AdsModel.getAudiences(getTenant(req)) }); } catch (error) { next(error); } }
async function addAudience(req, res, next) { try { res.json({ success: true, data: await AdsModel.createAudience(req.body, getTenant(req)) }); } catch (error) { next(error); } }
async function removeAudience(req, res, next) { try { res.json({ success: true, data: await AdsModel.deleteAudience(req.params.id, getTenant(req)) }); } catch (error) { next(error); } }

async function listCampaigns(req, res, next) { try { res.json({ success: true, data: await AdsModel.getCampaigns(getTenant(req)) }); } catch (error) { next(error); } }
async function addCampaign(req, res, next) { try { res.json({ success: true, data: await AdsModel.createCampaign(req.body, getTenant(req)) }); } catch (error) { next(error); } }
async function editCampaign(req, res, next) { try { res.json({ success: true, data: await AdsModel.updateCampaign(req.params.id, req.body, getTenant(req)) }); } catch (error) { next(error); } }

module.exports = { listAudiences, addAudience, removeAudience, listCampaigns, addCampaign, editCampaign };