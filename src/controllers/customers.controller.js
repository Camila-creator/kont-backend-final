const customersModel = require("../models/customers.model");
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;
function badRequest(res, message) { return res.status(400).json({ ok: false, message }); }

async function list(req, res, next) { try { res.json({ ok: true, data: await customersModel.listCustomers(getTenant(req)) }); } catch (e) { next(e); } }
async function getById(req, res, next) {
  try {
    const id = Number(req.params.id); if (!id) return badRequest(res, "id inválido");
    res.json({ ok: true, data: await customersModel.getCustomerById(id, getTenant(req)) });
  } catch (e) { next(e); }
}
async function create(req, res, next) {
  try {
    const { name, type } = req.body;
    if (!name || !name.toString().trim()) return badRequest(res, "name es requerido");
    if (!type || !type.toString().trim()) return badRequest(res, "type es requerido");
    req.body.tenant_id = getTenant(req);
    res.status(201).json({ ok: true, data: await customersModel.createCustomer(req.body) });
  } catch (e) { next(e); }
}
async function update(req, res, next) {
  try {
    const id = Number(req.params.id); if (!id) return badRequest(res, "id inválido");
    const { name, type } = req.body;
    if (name !== undefined && !name.toString().trim()) return badRequest(res, "name no puede estar vacío");
    if (type !== undefined && !type.toString().trim()) return badRequest(res, "type no puede estar vacío");
    const data = await customersModel.updateCustomer(id, req.body, getTenant(req));
    if (!data) return res.status(404).json({ ok: false, message: "Cliente no encontrado" }); res.json({ ok: true, data });
  } catch (e) { next(e); }
}
async function remove(req, res, next) {
  try {
    const id = Number(req.params.id); if (!id) return badRequest(res, "id inválido");
    const data = await customersModel.deleteCustomer(id, getTenant(req));
    if (!data) return res.status(404).json({ ok: false, message: "Cliente no encontrado" }); res.json({ ok: true, data });
  } catch (e) { next(e); }
}
module.exports = { list, getById, create, update, remove };