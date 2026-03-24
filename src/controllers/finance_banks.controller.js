const banks = require("../models/finance_banks.model");

const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

exports.list = async (req, res) => { 
    try {
        const lista = await banks.listBanks(getTenant(req));
        res.json(lista);
    } catch (err) {
        res.status(500).json({ error: "Error al listar bancos" });
    }
};

exports.create = async (req, res) => {
    const b = req.body || {}; 
    if (!b.name) return res.status(400).json({ error: "Nombre obligatorio" });

    try {
        b.tenant_id = getTenant(req);
        const resultado = await banks.createBank(b, req.user);
        res.status(201).json(resultado);
    } catch (err) {
        res.status(500).json({ error: "Error al crear banco" });
    }
};

exports.update = async (req, res) => {
    try {
        const updated = await banks.updateBank(Number(req.params.id), req.body, getTenant(req), req.user);
        if (!updated) return res.status(404).json({ error: "No encontrado" }); 
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Error al actualizar" });
    }
};

exports.remove = async (req, res) => {
    try {
        const out = await banks.deleteBank(Number(req.params.id), getTenant(req), req.user);
        if (!out) return res.status(404).json({ error: "No encontrado" }); 
        res.json({ ok: true, message: "Banco desactivado" });
    } catch (err) {
        res.status(500).json({ error: "Error al eliminar" });
    }
};