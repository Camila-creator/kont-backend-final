const db = require("../db");
const audit = require("../controllers/audit.controller");

async function listPending(tenantId) {
  const q = `
    SELECT 
        rp.id, rp.model_description, rp.imei, rp.amount, rp.status, rp.created_at,
        c.name AS customer_name, 
        o.order_number -- <--- Para que veas el # de pedido en la tabla
    FROM received_phones rp
    JOIN orders o ON rp.order_id = o.id
    JOIN customers c ON o.customer_id = c.id
    WHERE rp.tenant_id = $1 AND rp.status = 'PENDIENTE'
    ORDER BY rp.created_at ASC
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

async function processToInventory(data, tenantId, user) {
  const { id, destination, imei, name, category, price, cost } = data;
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    if (destination === 'PRODUCTO') {
      // Flujo de Teléfonos para Venta
      const qProd = `INSERT INTO products (tenant_id, name, category, buy_cost, retail_price, stock, requires_imei) 
                     VALUES ($1, $2, $3, $4, $5, 1, true) RETURNING id`;
      const resProd = await client.query(qProd, [tenantId, name, category, cost, price]);
      
      await client.query(
        `INSERT INTO product_serials (tenant_id, product_id, serial_number, status) VALUES ($1, $2, $3, 'DISPONIBLE')`,
        [tenantId, resProd.rows[0].id, imei]
      );
    } else {
      // Flujo de Insumos (Tu lógica de número correlativo nuevo)
      const qSupp = `
        INSERT INTO supplies (tenant_id, name, category_id, cost, stock, unit, supply_number) 
        VALUES (
            $1, $2, 
            (SELECT id FROM supply_categories WHERE name = $3 AND tenant_id = $1 LIMIT 1), 
            $4, 1, 'UNIDAD', 
            (SELECT COALESCE(MAX(supply_number), 0) + 1 FROM supplies WHERE tenant_id = $1)
        ) RETURNING id, supply_number`;
      
      const resSupp = await client.query(qSupp, [tenantId, name, category, cost]);
      
      await client.query(
        `INSERT INTO supply_serials (tenant_id, supply_id, serial_number) VALUES ($1, $2, $3)`,
        [tenantId, resSupp.rows[0].id, imei]
      );
    }

    // Actualizar el estado del equipo original
    await client.query(
      `UPDATE received_phones SET status = 'PROCESADO', processed_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    await client.query("COMMIT");
    
    await audit.saveAuditLogInternal({
      tenant_id: tenantId, user_id: user.id, user_name: user.name,
      module: 'ALMACEN', action: 'PROCESS_PHONE',
      description: `Equipo ${name} procesado como ${destination}. IMEI: ${imei}`
    });

    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { listPending, processToInventory };