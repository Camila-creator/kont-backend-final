// src/controllers/serial_controller.js
const db = require("../db");

// ─────────────────────────────────────────────────────────
// Obtener productos e insumos asignables (para el selector de IMEI)
// ─────────────────────────────────────────────────────────
exports.getAssignableItems = async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  const categoryId = Number(req.user.tenant_category_id || req.user.categoryId || 0);

  if (!tenantId) return res.status(403).json({ error: "ACCESO_DENEGADO_NO_TENANT" });

  // Módulo solo para categorías con IMEI (Tienda de Teléfonos = 1)
  if (![1].includes(categoryId) && req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Módulo exclusivo para tiendas de teléfonos." });
  }

  try {
    const [products, supplies] = await Promise.all([
      db.query("SELECT id, name, stock, 'PRODUCT' AS type FROM products WHERE tenant_id = $1 ORDER BY name", [tenantId], tenantId),
      db.query("SELECT id, name, stock, 'SUPPLY' AS type FROM supplies WHERE tenant_id = $1 ORDER BY name", [tenantId], tenantId),
    ]);

    res.json({ data: [...products.rows, ...supplies.rows] });
  } catch (err) {
    console.error("Error en getAssignableItems:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────
// Registrar IMEIs en lote
// LÓGICA 3 FIX: usar pool.connect() para la transacción (no db.query con BEGIN)
// SEGURIDAD 2 FIX: verificar que item_id pertenezca al tenant
// ─────────────────────────────────────────────────────────
exports.bulkRegister = async (req, res) => {
  const { item_id, item_type, serials } = req.body;
  const tenantId = req.user.tenant_id || req.user.tenantId;

  if (!tenantId) return res.status(403).json({ error: "ACCESO_DENEGADO_NO_TENANT" });

  if (!serials || !Array.isArray(serials) || serials.length === 0) {
    return res.status(400).json({ error: "No se enviaron seriales para registrar." });
  }
  if (!item_id || !item_type) {
    return res.status(400).json({ error: "item_id e item_type son obligatorios." });
  }
  if (!["PRODUCT", "SUPPLY"].includes(item_type)) {
    return res.status(400).json({ error: "item_type inválido. Debe ser PRODUCT o SUPPLY." });
  }

  // SEGURIDAD 2 FIX: verificar que el item pertenezca al tenant antes de modificarlo
  const table = item_type === "PRODUCT" ? "products" : "supplies";
  const ownerCheck = await db.query(
    `SELECT id FROM ${table} WHERE id = $1 AND tenant_id = $2`,
    [item_id, tenantId],
    tenantId
  );
  if (ownerCheck.rows.length === 0) {
    return res.status(403).json({ error: "El ítem no pertenece a tu empresa." });
  }

  // LÓGICA 3 FIX: usar pool.connect() para transacción manual
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = [];
    const skipped = [];

    for (const imei of serials) {
      const cleanImei = imei.toUpperCase().trim();
      if (!cleanImei) continue;

      // Verificar que el IMEI no exista ya para este tenant
      const exists = await client.query(
        `SELECT id FROM serial_numbers WHERE imei = $1 AND tenant_id = $2`,
        [cleanImei, tenantId]
      );

      if (exists.rows.length > 0) {
        skipped.push(cleanImei);
        continue;
      }

      await client.query(
        `INSERT INTO serial_numbers (tenant_id, imei, product_id, supply_id, status)
         VALUES ($1, $2, $3, $4, 'DISPONIBLE')`,
        [
          tenantId,
          cleanImei,
          item_type === "PRODUCT" ? item_id : null,
          item_type === "SUPPLY" ? item_id : null,
        ]
      );
      inserted.push(cleanImei);
    }

    // Actualizar stock solo por los IMEIs efectivamente insertados
    if (inserted.length > 0) {
      await client.query(
        `UPDATE ${table} SET stock = stock + $1 WHERE id = $2 AND tenant_id = $3`,
        [inserted.length, item_id, tenantId]
      );
    }

    await client.query("COMMIT");

    res.json({
      message: `${inserted.length} IMEI(s) registrados correctamente.`,
      inserted: inserted.length,
      skipped: skipped.length,
      skipped_imeis: skipped,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error en bulkRegister:", err.message);
    res.status(500).json({ error: "Error al registrar seriales: " + err.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────
// Listar todos los IMEIs del tenant
// ─────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  const tenantId = req.user.tenant_id || req.user.tenantId;
  if (!tenantId) return res.status(403).json({ error: "ACCESO_DENEGADO_NO_TENANT" });

  try {
    const q = `
      SELECT 
        s.id, s.imei, s.status,
        COALESCE(p.name, sup.name) AS item_name,
        CASE WHEN s.product_id IS NOT NULL THEN 'PRODUCT' ELSE 'SUPPLY' END AS item_type,
        s.product_id, s.supply_id, s.order_id,
        o.order_number AS sold_in_order
      FROM serial_numbers s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN supplies sup ON s.supply_id = sup.id
      LEFT JOIN orders o ON s.order_id = o.id
      WHERE s.tenant_id = $1
      ORDER BY s.id DESC
    `;
    const result = await db.query(q, [tenantId], tenantId);
    res.json({ data: result.rows });
  } catch (err) {
    console.error("Error en getAll serials:", err.message);
    res.status(500).json({ error: err.message });
  }
};
