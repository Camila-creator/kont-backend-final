const db = require("../db");
const audit = require("../controllers/audit.controller");

// ─────────────────────────────────────────────────────────
// LISTAR EQUIPOS PENDIENTES
// ─────────────────────────────────────────────────────────
async function listPending(tenantId) {
  const q = `
    SELECT 
        rp.id, rp.model_description, rp.credit_amount, rp.status, rp.created_at,
        c.name AS customer_name,
        o.order_number
    FROM received_phones rp
    JOIN orders o ON rp.order_id = o.id
    JOIN customers c ON o.customer_id = c.id
    WHERE rp.tenant_id = $1 AND rp.status = 'PENDIENTE'
    ORDER BY rp.created_at ASC
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

// ─────────────────────────────────────────────────────────
// BUG 1 FIX: usar serial_numbers (no product_serials ni supply_serials)
// LÓGICA 4 FIX: guardar IMEI también al procesar como PRODUCTO
// ─────────────────────────────────────────────────────────
async function processToInventory(data, tenantId, user) {
  const { id, destination, imei, name, category, price, cost } = data;

  // Validar IMEI obligatorio para ambos destinos
  if (!imei || imei.trim() === "") {
    throw new Error("El IMEI es obligatorio para procesar el equipo.");
  }

  const cleanImei = imei.toUpperCase().trim();
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    if (destination === "PRODUCTO") {
      // ── Insertar como Producto para venta ──
      const qProd = `
        INSERT INTO products (
          tenant_id, name, category, buy_cost, retail_price, stock,
          product_number
        )
        VALUES (
          $1, $2, $3, $4, $5, 1,
          (SELECT COALESCE(MAX(product_number), 0) + 1 FROM products WHERE tenant_id = $1)
        )
        RETURNING id`;
      const resProd = await client.query(qProd, [tenantId, name, category || "TELEFONO", cost || 0, price || 0]);
      const productId = resProd.rows[0].id;

      // LÓGICA 4 FIX: guardar el IMEI en serial_numbers (tabla real del schema)
      await client.query(
        `INSERT INTO serial_numbers (tenant_id, imei, product_id, status, origin_received_id)
         VALUES ($1, $2, $3, 'DISPONIBLE', $4)`,
        [tenantId, cleanImei, productId, id]
      );

    } else {
      // ── Insertar como Insumo ──
      const qSupp = `
        INSERT INTO supplies (
          tenant_id, name, category_id, cost, stock, unit, supply_number
        )
        VALUES (
          $1, $2,
          (SELECT id FROM supply_categories WHERE name = $3 AND tenant_id = $1 LIMIT 1),
          $4, 1, 'UNIDAD',
          (SELECT COALESCE(MAX(supply_number), 0) + 1 FROM supplies WHERE tenant_id = $1)
        )
        RETURNING id`;
      const resSupp = await client.query(qSupp, [tenantId, name, category, cost || 0]);
      const supplyId = resSupp.rows[0].id;

      // BUG 1 FIX: guardar en serial_numbers con supply_id (no en supply_serials)
      await client.query(
        `INSERT INTO serial_numbers (tenant_id, imei, supply_id, status, origin_received_id)
         VALUES ($1, $2, $3, 'DISPONIBLE', $4)`,
        [tenantId, cleanImei, supplyId, id]
      );
    }

    // Marcar el equipo recibido como procesado
    await client.query(
      `UPDATE received_phones SET status = 'PROCESADO', processed_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    await client.query("COMMIT");

    // Auditoría fuera de la transacción (no crítica)
    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: user.id,
      user_name: user.name,
      module: "ALMACEN",
      action: "PROCESS_PHONE",
      description: `Equipo "${name}" procesado como ${destination}. IMEI: ${cleanImei}`,
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
