const db = require("../db");
const audit = require("../controllers/audit.controller");

// --- ROLES ---
async function getAllRoles(tenantId) {
    const q = "SELECT * FROM mkt_roles WHERE tenant_id = $1 ORDER BY id ASC";
    const r = await db.query(q, [tenantId], tenantId);
    return r.rows;
}

async function createRole(name, tenantId, user) {
    const q = "INSERT INTO mkt_roles (tenant_id, name) VALUES ($1, $2) RETURNING *";
    const r = await db.query(q, [tenantId, name], tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'CREATE_ROLE',
            description: `Nuevo rol de marketing: ${name}`
        });
    }
    return r.rows[0];
}

async function deleteRole(id, tenantId, user) {
    const q = "DELETE FROM mkt_roles WHERE id = $1 AND tenant_id = $2 RETURNING *"; 
    const r = await db.query(q, [id, tenantId], tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'DELETE_ROLE',
            description: `Se eliminó el rol ID: ${id}`
        });
    }
    return true;
}

// --- TAREAS ---
async function createTask(data, tenantId, user) {
    const q = `INSERT INTO mkt_tasks (tenant_id, title, role_id, priority, start_date, deadline, status, description, link_resources, link_deliverable, feedback) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`;
    const v = [tenantId, data.title, data.role_id, data.priority, data.start_date, data.deadline, data.status, data.description, data.link_resources, data.link_deliverable, data.feedback];
    const r = await db.query(q, v, tenantId);
    const result = r.rows[0];

    if (result && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'CREATE_TASK',
            description: `Nueva tarea: ${data.title}`
        });
    }
    return result;
}

async function updateTask(id, data, tenantId, user) {
    const q = `UPDATE mkt_tasks SET title=$3, role_id=$4, priority=$5, start_date=$6, deadline=$7, status=$8, description=$9, link_resources=$10, link_deliverable=$11, feedback=$12 
               WHERE id = $1 AND tenant_id = $2 RETURNING *`;
    const v = [id, tenantId, data.title, data.role_id, data.priority, data.start_date, data.deadline, data.status, data.description, data.link_resources, data.link_deliverable, data.feedback];
    const r = await db.query(q, v, tenantId);
    
    if (r.rows[0] && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, user_id: user.id, user_name: user.name,
            module: 'MARKETING', action: 'UPDATE_TASK',
            description: `Actualizada tarea: ${data.title} (Estado: ${data.status})`
        });
    }
    return r.rows[0];
}

module.exports = { getAllRoles, createRole, deleteRole, getAllTasks: (tid) => db.query("SELECT * FROM mkt_tasks WHERE tenant_id = $1 ORDER BY deadline ASC", [tid], tid).then(r => r.rows), createTask, updateTask };