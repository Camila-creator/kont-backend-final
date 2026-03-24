const db = require("../db");
const audit = require("../controllers/audit.controller");

exports.listProductions = async (tenantId) => {
  const q = `
    SELECT 
      p.id, 
      p.status, 
      p.production_date, 
      p.notes, 
      pi.qty_made, 
      prod.name as product_name,
      -- Agregamos el correlativo por tenant para que el usuario vea 1, 2, 3...
      ROW_NUMBER() OVER (PARTITION BY p.tenant_id ORDER BY p.created_at ASC) as display_id
    FROM productions p
    JOIN production_items pi ON pi.production_id = p.id
    JOIN products prod ON prod.id = pi.product_id
    WHERE p.tenant_id = $1 
      AND pi.tenant_id = $1 
      AND prod.tenant_id = $1
    ORDER BY p.created_at DESC
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
};

// ... (tus funciones previewProduction y createProduction se mantienen igual)

exports.previewProduction = async ({ product_id, qty_made, tenant_id }) => {
  const recipeR = await db.query(
    `SELECT id FROM recipes WHERE product_id = $1 AND tenant_id = $2`,
    [product_id, tenant_id],
    tenant_id
  );

  if (recipeR.rows.length === 0) return { ok: false, error: "Producto sin receta." };

  const recipeId = recipeR.rows[0].id;
  const itemsQ = `
    SELECT ri.supply_id, ri.qty AS recipe_qty, s.name AS supply_name, s.stock AS current_stock, s.unit
    FROM recipe_items ri
    JOIN supplies s ON s.id = ri.supply_id
    WHERE ri.recipe_id = $1 AND ri.tenant_id = $2
  `;
  const itemsR = await db.query(itemsQ, [recipeId, tenant_id], tenant_id);

  const items = itemsR.rows.map(it => {
    const required = Number(it.recipe_qty) * Number(qty_made);
    const stock = Number(it.current_stock || 0);
    return {
      supply_id: it.supply_id,
      name: it.supply_name,
      unit: it.unit,
      required,
      stock,
      missing: Math.max(0, required - stock)
    };
  });

  return { ok: true, can_produce: items.every(it => it.missing === 0), items };
};

exports.createProduction = async ({ tenant_id, product_id, qty_made, notes, production_date }, user) => {
  const preview = await exports.previewProduction({ product_id, qty_made, tenant_id });
  if (!preview.ok || !preview.can_produce) return { ok: false, error: "Stock insuficiente." };

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenant_id.toString()]);

    const prodR = await client.query(
      `INSERT INTO productions (tenant_id, status, notes, production_date) VALUES ($1, 'COMPLETADO', $2, $3) RETURNING id`,
      [tenant_id, notes, production_date || new Date()]
    );
    const productionId = prodR.rows[0].id;

    await client.query(
      `INSERT INTO production_items (tenant_id, production_id, product_id, qty_made) VALUES ($1, $2, $3, $4)`,
      [tenant_id, productionId, product_id, qty_made]
    );

    for (const item of preview.items) {
      await client.query(
        `INSERT INTO production_consumption (tenant_id, production_id, supply_id, qty_used, unit) VALUES ($1, $2, $3, $4, $5)`,
        [tenant_id, productionId, item.supply_id, item.required, item.unit]
      );

      await client.query(
        `UPDATE supplies SET stock = stock - $1 WHERE id = $2 AND tenant_id = $3`,
        [item.required, item.supply_id, tenant_id]
      );
    }

    await client.query(
      `UPDATE products SET stock = stock + $1 WHERE id = $2 AND tenant_id = $3`,
      [qty_made, product_id, tenant_id]
    );

    await client.query("COMMIT");

    if (user) {
      await audit.saveAuditLogInternal({
        tenant_id: tenant_id,
        user_id: user.id,
        user_name: user.name,
        module: 'PRODUCCION',
        action: 'CREATE_PRODUCTION',
        description: `Producción de ${qty_made} unidades del producto ID ${product_id} finalizada.`
      });
    }

    return { ok: true, id: productionId };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};