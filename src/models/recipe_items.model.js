const db = require("../db");

async function listItemsByRecipeId(recipeId, tenantId) {
  const q = `
    SELECT id, recipe_id, supply_id, qty, unit
    FROM recipe_items
    WHERE recipe_id = $1 AND tenant_id = $2
    ORDER BY id ASC
  `;
  const r = await db.query(q, [recipeId, tenantId], tenantId);
  return r.rows;
}


async function replaceItems(recipeId, items = [], tenantId) {
  // Limpia items previos de esa receta
  await db.query(
    "DELETE FROM recipe_items WHERE recipe_id = $1 AND tenant_id = $2", 
    [recipeId, tenantId], 
    tenantId
  );

  if (!items || items.length === 0) return [];

  // Evita duplicados de insumos en la misma receta
  const uniqueItems = Array.from(new Map(items.map(item => [item.supply_id, item])).values());
  const values = [];
  const params = [];
  let i = 1;

  for (const it of uniqueItems) {
    // Coincidiendo con tus 5 columnas: recipe_id, supply_id, qty, unit, tenant_id
    values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    params.push(recipeId, Number(it.supply_id), Number(it.qty), it.unit || null, tenantId);
  }

  const q = `
    INSERT INTO recipe_items (recipe_id, supply_id, qty, unit, tenant_id)
    VALUES ${values.join(",")}
    RETURNING *
  `;
  const r = await db.query(q, params, tenantId);
  return r.rows;
}

module.exports = { listItemsByRecipeId, replaceItems };