const db = require("../db");
const audit = require("../controllers/audit.controller");

// Funciones de ayuda internas
const normalizeType = (t) => (["RETAIL", "MAYORISTA"].includes(t?.toUpperCase()) ? t.toUpperCase() : "RETAIL");
const normalizeTerms = (t) => (["CONTADO", "CREDITO"].includes(t?.toUpperCase()) ? t.toUpperCase() : "CONTADO");

/**
 * LISTAR CLIENTES
 */
async function listCustomers(tenantId) {
    const q = `SELECT * FROM customers WHERE tenant_id = $1 ORDER BY name ASC`;
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows;
}

/**
 * OBTENER CLIENTE POR ID
 */
async function getCustomerById(id, tenantId) {
    const q = `SELECT * FROM customers WHERE id = $1 AND tenant_id = $2`;
    const r = await db.query(q, [id, tenantId], tenantId);
    return r.rows[0] || null;
}

/**
 * CREAR CLIENTE
 */
async function createCustomer(payload, user) {
    const name = (payload.name || "").toString().trim();
    const type = normalizeType(payload.type);
    const terms = normalizeTerms(payload.terms);
    const tenant_id = payload.tenant_id;
    
    const q = `INSERT INTO customers (tenant_id, name, type, doc, phone, email, location, address, terms, wholesale_min, notes) 
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`;
    const v = [tenant_id, name, type, payload.doc, payload.phone, payload.email, payload.location, payload.address, terms, payload.wholesale_min, payload.notes];
    
    const r = await db.query(q, v, tenant_id);
    const cliente = r.rows[0];

    if (cliente && user) {
        await audit.saveAuditLogInternal({
            tenant_id,
            user_id: user.id,
            user_name: user.name,
            module: 'CLIENTES',
            action: 'CREATE',
            description: `Nuevo cliente creado: ${name} (${type})`
        });
    }
    return cliente;
}

/**
 * ACTUALIZAR CLIENTE
 */
async function updateCustomer(id, payload, tenantId, user) {
    const existing = await getCustomerById(id, tenantId);
    if (!existing) return null;

    const q = `UPDATE customers SET name = $2, type = $3, doc = $4, phone = $5, email = $6, location = $7, address = $8, terms = $9, wholesale_min = $10, notes = $11, updated_at = now() 
               WHERE id = $1 AND tenant_id = $12 RETURNING *`;
    const v = [id, payload.name ?? existing.name, payload.type ?? existing.type, payload.doc ?? existing.doc, payload.phone ?? existing.phone, payload.email ?? existing.email, payload.location ?? existing.location, payload.address ?? existing.address, payload.terms ?? existing.terms, payload.wholesale_min ?? existing.wholesale_min, payload.notes ?? existing.notes, tenantId];
    
    const r = await db.query(q, v, tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId,
            user_id: user.id,
            user_name: user.name,
            module: 'CLIENTES',
            action: 'UPDATE',
            description: `Datos actualizados del cliente: ${r.rows[0].name}`
        });
    }
    return r.rows[0];
}

/**
 * ELIMINAR CLIENTE
 */
async function deleteCustomer(id, tenantId, user) {
    const q = `DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING name`;
    const r = await db.query(q, [id, tenantId], tenantId);
    
    if (r.rowCount > 0 && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId,
            user_id: user.id,
            user_name: user.name,
            module: 'CLIENTES',
            action: 'DELETE',
            description: `Cliente eliminado: ${r.rows[0].name}`
        });
    }
    return r.rowCount > 0;
}

// 🛡️ EXPORTACIÓN LIMPIA (Sin require recursivos)
module.exports = { 
    listCustomers, 
    getCustomerById, 
    createCustomer, 
    updateCustomer, 
    deleteCustomer 
};