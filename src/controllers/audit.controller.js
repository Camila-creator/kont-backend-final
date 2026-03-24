const db = require("../db");

/**
 * 1. Obtener logs filtrados por rol y empresa
 * GET /api/audit
 */
exports.getAuditLogs = async (req, res) => {
    try {
        // Obtenemos los datos del usuario desde el middleware de autenticación
        const { role, tenant_id } = req.user; 
        
        let query;
        let params = [];

        // CASO A: Super Admin - Ve absolutamente todo
        if (role === "SUPER_ADMIN") {
            query = `
                SELECT 
                    a.id, a.created_at, a.user_name, a.action, a.module, a.description, a.ip_address,
                    COALESCE(t.name, 'SISTEMA CORE') as tenant_name
                FROM audit_logs a
                LEFT JOIN tenants t ON a.tenant_id = t.id
                ORDER BY a.created_at DESC
                LIMIT 500
            `;
        } 
        // CASO B: Admin de Empresa - Ve SOLO lo de su tenant_id
        else if (role === "ADMIN_BRAND") {
            query = `
                SELECT 
                    a.id, a.created_at, a.user_name, a.action, a.module, a.description, a.ip_address,
                    t.name as tenant_name
                FROM audit_logs a
                INNER JOIN tenants t ON a.tenant_id = t.id
                WHERE a.tenant_id = $1
                ORDER BY a.created_at DESC
                LIMIT 500
            `;
            params = [tenant_id];
        } 
        // CASO C: Otros roles - Acceso denegado
        else {
            return res.status(403).json({ 
                error: "Acceso denegado: No tienes permisos para ver la auditoría." 
            });
        }

        const result = await db.pool.query(query, params);
        res.json({ data: result.rows });

    } catch (error) {
        console.error("Error en getAuditLogs:", error);
        res.status(500).json({ error: "Error interno al obtener la bitácora." });
    }
};

/**
 * 2. Guardar un nuevo log (Desde el Frontend)
 */
exports.saveAuditLog = async (req, res) => {
    try {
        const { tenant_id, user_id, user_name, module, action, description, metadata } = req.body;
        const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

        await db.pool.query(
            `INSERT INTO audit_logs (tenant_id, user_id, user_name, module, action, description, metadata, ip_address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tenant_id, user_id, user_name, module, action, description, metadata || {}, ip_address]
        );

        res.status(201).json({ message: "Actividad registrada." });
    } catch (error) {
        console.error("Error en saveAuditLog:", error);
        res.status(500).json({ error: "Error al registrar auditoría." });
    }
};

/**
 * 3. Función interna para procesos del backend
 */
exports.saveAuditLogInternal = async (data) => {
    try {
        const { tenant_id, user_id, user_name, module, action, description, metadata } = data;
        const ip = data.ip_address || '127.0.0.1';

        await db.pool.query(
            `INSERT INTO audit_logs (tenant_id, user_id, user_name, module, action, description, metadata, ip_address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tenant_id, user_id, user_name, module, action, description, metadata || {}, ip]
        );
        return true;
    } catch (error) {
        console.error("Error interno guardando auditoría:", error);
        return false;
    }
};