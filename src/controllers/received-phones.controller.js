const db = require("../db");

/**
 * 1. Listar equipos recibidos (CON EL NÚMERO DE ORDEN)
 */
exports.getPending = async (req, res) => {
    try {
        const { tenant_id } = req.user;

        const query = `
            SELECT 
                r.*, 
                c.name as customer_name,
                o.order_number -- <--- ESTA ES LA COLUMNA QUE TE FALTABA
            FROM received_phones r 
            INNER JOIN orders o ON r.order_id = o.id 
            INNER JOIN customers c ON o.customer_id = c.id
            WHERE r.status = 'PENDIENTE' AND r.tenant_id = $1
            ORDER BY r.created_at DESC
        `;
        
        const result = await db.pool.query(query, [tenant_id]);
        res.json({ data: result.rows });
    } catch (error) {
        console.error("Error en getPending:", error);
        res.status(500).json({ error: "Error al obtener la lista." });
    }
};

/**
 * 2. Procesar equipo (CON NÚMERO DE INSUMO NUEVO)
 */
exports.processIntoInventory = async (req, res) => {
    const { id, destination, category, imei, cost, price, name } = req.body;
    const { tenant_id, user_id, user_name } = req.user;
    
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        if (destination === 'PRODUCTO') {
            // Insertar como Producto (Venta)
            await client.query(
                `INSERT INTO products (tenant_id, name, category, buy_cost, retail_price, stock, requires_imei) 
                 VALUES ($1, $2, $3, $4, $5, 1, true)`,
                [tenant_id, name, category, cost, price]
            );
            // Aquí podrías insertar el imei en product_serials si usas esa tabla
        } else {
            // --- LÓGICA DE INSUMO (Tu número correlativo nuevo) ---
            await client.query(
                `INSERT INTO supplies (
                    tenant_id, name, category_id, cost, stock, unit, supply_number
                ) 
                VALUES (
                    $1, $2, 
                    (SELECT id FROM supply_categories WHERE name = $3 AND tenant_id = $1 LIMIT 1), 
                    $4, 1, 'UNIDAD', 
                    (SELECT COALESCE(MAX(supply_number), 0) + 1 FROM supplies WHERE tenant_id = $1)
                )`,
                [tenant_id, name, category, cost]
            );
        }

        // Marcar como PROCESADO
        await client.query(
            `UPDATE received_phones SET status = 'PROCESADO', processed_at = NOW() 
             WHERE id = $1 AND tenant_id = $2`, 
            [id, tenant_id]
        );

        // Auditoría
        await client.query(
            `INSERT INTO audit_logs (tenant_id, user_id, user_name, module, action, description) 
             VALUES ($1, $2, $3, 'INVENTARIO', 'PROCESAR_EQUIPO', $4)`,
            [tenant_id, user_id, user_name, `Equipo ${name} procesado como ${destination}`]
        );

        await client.query('COMMIT');
        res.json({ message: "Equipo integrado al sistema correctamente." });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al procesar equipo:", error);
        res.status(500).json({ error: "No se pudo procesar el equipo." });
    } finally {
        client.release();
    }
};