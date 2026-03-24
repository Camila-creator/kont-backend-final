const db = require("../db");

// 1. Crear un nuevo ticket de soporte (Ya estaba bien, pero aseguramos coherencia)
exports.createTicket = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id || req.user.tenantId;
        const userId = req.user.id;
        const { subject, priority, message } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ error: "El asunto y el mensaje son obligatorios." });
        }

        const validPriority = ['ALTA', 'MEDIA', 'BAJA'].includes(priority) ? priority : 'BAJA';

        const q = `
            INSERT INTO support_tickets (tenant_id, user_id, subject, message, priority, status)
            VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')
            RETURNING id;
        `;
        
        // Pasamos tenantId en los valores ($1) Y como tercer parámetro para el RLS
        const result = await db.query(q, [tenantId, userId, subject, message, validPriority], tenantId);
        
        res.status(201).json({ 
            success: true, 
            message: "Ticket creado exitosamente", 
            ticketId: result.rows[0].id 
        });

    } catch (error) {
        console.error("Error al crear ticket de soporte:", error);
        res.status(500).json({ error: "Hubo un error al enviar tu reporte." });
    }
};

// 2. Obtener el historial de tickets de ESTA empresa (AQUÍ ESTABA EL FILTRO)
exports.getMyTickets = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id || req.user.tenantId;

        // 🛡️ AHORA SÍ: Agregamos el WHERE explícito
        const q = `
            SELECT id, subject, priority, status, created_at 
            FROM support_tickets 
            WHERE tenant_id = $1
            ORDER BY created_at DESC;
        `;
        
        // Pasamos el tenantId en el array de parámetros para el $1
        const { rows } = await db.query(q, [tenantId], tenantId); 
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error("Error al obtener mis tickets:", error);
        res.status(500).json({ error: "Error al cargar el historial de tickets." });
    }
};