// src/models/recipes.model.js
const db = require("../db");
const { listItemsByRecipeId, replaceItems } = require("./recipe_items.model");
const audit = require("../controllers/audit.controller");

/**
 * Sincroniza el buy_cost del producto basado en el costo total de su receta.
 * Esto asegura que el inventario siempre refleje el costo real de producción.
 */
async function syncProductCost(productId, tenantId) {
    const q = `
        UPDATE products p
        SET buy_cost = (
            SELECT 
                CASE 
                    WHEN r.waste_type = 'PERCENT' THEN totals.base * (1 + r.waste_value / 100)
                    ELSE totals.base + r.waste_value
                END
            FROM recipes r
            JOIN (
                SELECT ri.recipe_id, SUM(ri.qty * s.cost) as base
                FROM recipe_items ri
                JOIN supplies s ON ri.supply_id = s.id
                GROUP BY ri.recipe_id
            ) totals ON r.id = totals.recipe_id
            WHERE r.product_id = p.id AND r.tenant_id = p.tenant_id
        )
        WHERE p.id = $1 AND p.tenant_id = $2
    `;
    await db.query(q, [productId, tenantId], tenantId);
}

/**
 * Obtiene una receta completa incluyendo sus items/insumos.
 */
async function getRecipeByProductId(p, t) {
    const r = await db.query(`SELECT * FROM recipes WHERE product_id=$1 AND tenant_id=$2`, [p, t], t);
    if (!r.rows[0]) return null;
    
    const recipe = r.rows[0];
    const items = await listItemsByRecipeId(recipe.id, t);
    return { ...recipe, items };
}

/**
 * Crea una nueva receta y sincroniza el costo del producto.
 */
async function createRecipe(data, user) {
    const { tenant_id, product_id, notes, waste_type, waste_value, items } = data;
    
    const q = `
        INSERT INTO recipes (tenant_id, product_id, notes, waste_type, waste_value)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const r = await db.query(q, [
        tenant_id, 
        product_id, 
        notes || null, 
        waste_type || "PERCENT", 
        waste_value ?? 0
    ], tenant_id);
    
    const recipe = r.rows[0];
    
    // Guardamos los insumos en la tabla intermedia
    const savedItems = await replaceItems(recipe.id, items || [], tenant_id);
    
    // Sincronizamos el costo en la tabla de productos
    await syncProductCost(product_id, tenant_id);
    
    if (recipe && user) {
        await audit.saveAuditLogInternal({
            tenant_id, 
            user_id: user.id, 
            user_name: user.name,
            module: 'PRODUCCION', 
            action: 'CREATE_RECIPE',
            description: `Fórmula creada para producto ID ${product_id}. Costo actualizado.`
        });
    }
    
    return { ...recipe, items: savedItems };
}

/**
 * Actualiza o Crea (Upsert) una receta para un producto específico.
 */
async function upsertRecipeByProductId(data, user) {
    const { tenant_id, product_id, notes, waste_type, waste_value, items } = data;
    const existing = await getRecipeByProductId(product_id, tenant_id);

    if (!existing) {
        return createRecipe(data, user);
    }

    const q = `
        UPDATE recipes
        SET notes = $3, waste_type = $4, waste_value = $5, updated_at = now()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
    `;
    
    const r = await db.query(q, [
        existing.id, 
        tenant_id, 
        notes || null, 
        waste_type || "PERCENT", 
        waste_value ?? 0
    ], tenant_id);
    
    const recipe = r.rows[0];
    
    // Reemplazamos los insumos viejos por los nuevos
    const savedItems = await replaceItems(recipe.id, items || [], tenant_id);

    // Sincronizamos el costo tras la actualización de insumos o merma
    await syncProductCost(product_id, tenant_id);

    if (user) {
        await audit.saveAuditLogInternal({
            tenant_id, 
            user_id: user.id, 
            user_name: user.name,
            module: 'PRODUCCION', 
            action: 'UPDATE_RECIPE',
            description: `Fórmula actualizada para producto ID ${product_id}.`
        });
    }
    
    return { ...recipe, items: savedItems };
}

/**
 * Elimina una receta y sus items asociados.
 */
async function deleteRecipeByProductId(productId, tenantId, user) {
    const existing = await getRecipeByProductId(productId, tenantId);
    if (!existing) return null;

    // Los items se eliminan por ON DELETE CASCADE o manualmente en replaceItems
    const r = await db.query(
        `DELETE FROM recipes WHERE id = $1 AND tenant_id = $2 RETURNING id`, 
        [existing.id, tenantId], 
        tenantId
    );
    
    if (r.rowCount > 0 && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, 
            user_id: user.id, 
            user_name: user.name,
            module: 'PRODUCCION', 
            action: 'DELETE_RECIPE',
            description: `Eliminada receta de producto ID ${productId}.`
        });
    }
    
    return r.rows[0] || null;
}

module.exports = { 
    listRecipes: async (t) => {
        const res = await db.query(`SELECT * FROM recipes WHERE tenant_id=$1 ORDER BY id DESC`, [t], t);
        return res.rows;
    },
    getRecipeByProductId,
    upsertRecipeByProductId, 
    deleteRecipeByProductId 
};