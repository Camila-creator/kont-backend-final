const CalendarModel = require("../models/mkt_calendar.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

async function listPosts(req, res, next) { try { res.json({ success: true, data: await CalendarModel.getPosts(getTenant(req)) }); } catch (error) { next(error); } }
async function addPost(req, res, next) { try { res.json({ success: true, data: await CalendarModel.createPost(req.body, getTenant(req)) }); } catch (error) { next(error); } }
async function editPost(req, res, next) { try { res.json({ success: true, data: await CalendarModel.updatePost(req.params.id, req.body, getTenant(req)) }); } catch (error) { next(error); } }

async function fetchMetrics(req, res, next) { try { res.json({ success: true, data: await CalendarModel.getLatestMetrics(getTenant(req)) }); } catch (error) { next(error); } }
async function recordMetrics(req, res, next) { try { res.json({ success: true, data: await CalendarModel.saveMetrics(req.body, getTenant(req)) }); } catch (error) { next(error); } }

module.exports = { listPosts, addPost, editPost, fetchMetrics, recordMetrics };