const accounts = require("../models/finance_accounts.model");

const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

exports.list = async (req, res) => { 
    try {
        const data = await accounts.listAccounts(getTenant(req));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: "Error al listar cuentas" });
    }
};

exports.create = async (req, res) => {
    const b = req.body || {}; 
    b.type = (b.type || b.kind || "").toString().trim().toUpperCase();
    if (!b.type || !b.name) return res.status(400).json({ error: "type y name son obligatorios" });

    try { 
        b.tenant_id = getTenant(req); 
        // PASAMOS req.user como SEGUNDO argumento
        const nuevo = await accounts.createAccount(b, req.user);
        res.status(201).json(nuevo); 
    } catch (e) { 
        res.status(400).json({ error: e.message || "No se pudo crear" }); 
    }
};

exports.update = async (req, res) => {
    const id = Number(req.params.id); 
    if (!id) return res.status(400).json({ error: "ID inválido" });
    
    try {
        const body = req.body || {}; 
        if (body.kind && !body.type) body.type = body.kind;
        
        // PASAMOS req.user como CUARTO argumento
        const updated = await accounts.updateAccount(id, body, getTenant(req), req.user);
        
        if (!updated) return res.status(404).json({ error: "Cuenta no encontrada" }); 
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Error al actualizar" });
    }
};

exports.remove = async (req, res) => {
    const id = Number(req.params.id); 
    if (!id) return res.status(400).json({ error: "ID inválido" });
    
    try {
        // PASAMOS req.user como TERCER argumento
        const out = await accounts.deleteAccount(id, getTenant(req), req.user);
        
        if (!out) return res.status(404).json({ error: "No encontrada" }); 
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Error al eliminar" });
    }
};