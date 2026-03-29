const db = require("../db");
const audit = require("../controllers/audit.controller");
const alertController = require("../controllers/alert.controller");

async function listProducts(tenantId) {
  // Traemos todo incluyendo product_number
  const q = `SELECT * FROM products WHERE tenant_id = $1 ORDER BY product_number DESC`;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

async function getProductById(id, tenantId) {
  const q = `
    SELECT 
        p.*,
        COALESCE(recipe_totals.base_cost, 0) as costo_base_receta,
        COALESCE(
            CASE 
                WHEN r.waste_type = 'PERCENT' THEN recipe_totals.base_cost * (1 + r.waste_value / 100)
                ELSE recipe_totals.base_cost + r.waste_value
            END, 
            0
        ) as costo_real_insumos
    FROM products p
    LEFT JOIN recipes r ON p.id = r.product_id AND p.tenant_id = r.tenant_id
    LEFT JOIN (
        SELECT 
            ri.recipe_id, 
            SUM(ri.qty * s.cost) as base_cost
        FROM recipe_items ri
        JOIN supplies s ON ri.supply_id = s.id
        GROUP BY ri.recipe_id
    ) as recipe_totals ON r.id = recipe_totals.recipe_id
    WHERE p.id = $1 AND p.tenant_id = $2
  `;
  const r = await db.query(q, [id, tenantId], tenantId);
  return r.rows[0] || null;
}

async function createProduct(p, user) {
  // La subconsulta (SELECT COALESCE...) garantiza que el número sea correlativo por cliente
  const q = `
    INSERT INTO products
    (tenant_id, name, category, supplier_id, unit, buy_cost, retail_price, mayor_price, stock, min_stock, has_expiry, expiry_date, product_number)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
            (SELECT COALESCE(MAX(product_number), 0) + 1 FROM products WHERE tenant_id = $1))
    RETURNING *
  `;
  
  const values = [
    p.tenant_id, p.name, p.category, p.supplier_id, p.unit, 
    p.buy_cost, p.retail_price, p.mayor_price, 
    p.stock, p.min_stock, p.has_expiry, p.expiry_date
  ];
  
  const r = await db.query(q, values, p.tenant_id);
  const result = r.rows[0];

  if (result && user) {
    await audit.saveAuditLogInternal({
      tenant_id: p.tenant_id, user_id: user.id, user_name: user.name,
      module: 'INVENTARIO', action: 'CREATE_PRODUCT',
      description: `Producto #${result.product_number} creado: ${p.name}.`
    });
  }
  return result;
}

async function updateProduct(id, p, tenantId, user) {
  const q = `
    UPDATE products SET
      name=$3, category=$4, supplier_id=$5, unit=$6, buy_cost=$7,
      retail_price=$8, mayor_price=$9, stock=$10, min_stock=$11,
      has_expiry=$12, expiry_date=$13, updated_at=now()
    WHERE id=$1 AND tenant_id = $2
    RETURNING *
  `;
  const values = [
    id, tenantId, p.name, p.category, p.supplier_id, p.unit, 
    p.buy_cost, p.retail_price, p.mayor_price, 
    p.stock, p.min_stock, p.has_expiry, p.expiry_date
  ];
  
  const r = await db.query(q, values, tenantId);
  const result = r.rows[0];

  // 1. Verificación de existencia (Seguridad técnica)
  if (!result) return null;

  // 2. Registro en auditoría
  if (user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId, 
      user_id: user.id, 
      user_name: user.name,
      module: 'INVENTARIO', 
      action: 'UPDATE_PRODUCT',
      description: `Producto #${result.product_number || id} actualizado.`
    });
  }

  // 3. Lógica de Alerta de Stock
  // Solo disparamos si el stock es menor o igual al mínimo Y el stock es mayor a 0 
  // (para no spamear alertas si ya está en cero y solo editaste el nombre, por ejemplo)
  if (Number(result.stock) <= Number(result.min_stock)) {
    await alertController.createAlertInternal({
        tenant_id: tenantId,
        tipo: 'STOCK_PRODUCTO',
        titulo: '⚠️ Stock Crítico',
        mensaje: `El producto "${result.name}" tiene unidades bajas (${result.stock} restantes).`,
        referencia_id: result.id,
        prioridad: 'ALTA'
    });
  }

  return result;
}

async function deleteProduct(id, tenantId) {
  const q = "DELETE FROM products WHERE id=$1 AND tenant_id = $2 RETURNING *";
  const r = await db.query(q, [id, tenantId], tenantId);
  return r.rowCount > 0;
}

async function countProductsByTenant(tenantId) {
  const res = await db.query(
    "SELECT COUNT(*) FROM products WHERE tenant_id = $1",
    [tenantId]
  );
  return parseInt(res.rows[0].count);
}

// Exportación única y limpia
module.exports = { 
  listProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  countProductsByTenant 
};