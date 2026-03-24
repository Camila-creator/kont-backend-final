const TaskModel = require("../models/mkt_tasks.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

async function getRoles(req, res, next) { try { res.json({ success: true, data: await TaskModel.getAllRoles(getTenant(req)) }); } catch (e) { next(e); } }
async function addRole(req, res, next) { try { res.json({ success: true, data: await TaskModel.createRole(req.body.name, getTenant(req)) }); } catch (e) { next(e); } }
async function removeRole(req, res, next) { try { await TaskModel.deleteRole(req.params.id, getTenant(req)); res.json({ success: true }); } catch (e) { next(e); } }

async function getTasks(req, res, next) { try { res.json({ success: true, data: await TaskModel.getAllTasks(getTenant(req)) }); } catch (e) { next(e); } }
async function addTask(req, res, next) { try { res.json({ success: true, data: await TaskModel.createTask(req.body, getTenant(req)) }); } catch (e) { next(e); } }
async function editTask(req, res, next) { try { res.json({ success: true, data: await TaskModel.updateTask(req.params.id, req.body, getTenant(req)) }); } catch (e) { next(e); } }

module.exports = { getRoles, addRole, removeRole, getTasks, addTask, editTask };