const db = require("../db");
const audit = require("../controllers/audit.controller");

/**
 * LISTAR: Con JOIN a categorías y ordenado por el número correlativo
 */
async function listSupplies(tenantId) {
  const q = `
    SELECT 
        s.id, 
        s.supply_number, -- Nuevo campo correlativo
        s.name AS nombre, 
        s.unit AS unidad, 
        s.supplier_id AS proveedor_id, 
        s.cost AS costo, 
        s.stock, 
        s.min_stock, 
        s.has_expiry, 
        s.expiry_date, 
        s.created_at, 
        s.updated_at,
        s.category_id,
        c.name AS categoria_nombre,
        c.color AS categoria_color
    FROM supplies s
    LEFT JOIN supply_categories c ON s.category_id = c.id
    WHERE s.tenant_id = $1 
    ORDER BY s.supply_number DESC
  `;
  const r = await db.query(q, [tenantId], tenantId); 
  return r.rows;
}

/**
 * OBTENER POR ID: Incluye el supply_number y datos de categoría
 */
async function getSupplyById(id, tenantId) {
  const q = `
    SELECT 
        s.id, 
        s.supply_number,
        s.name AS nombre, 
        s.unit AS unidad, 
        s.supplier_id AS proveedor_id, 
        s.cost AS costo, 
        s.stock, 
        s.min_stock, 
        s.has_expiry, 
        s.expiry_date, 
        s.created_at, 
        s.updated_at,
        s.category_id,
        c.name AS categoria_nombre,
        c.color AS categoria_color
    FROM supplies s
    LEFT JOIN supply_categories c ON s.category_id = c.id
    WHERE s.id = $1 AND s.tenant_id = $2
  `;
  const r = await db.query(q, [id, tenantId], tenantId);
  return r.rows[0] || null;
}

/**
 * CREAR: Genera automáticamente el supply_number correlativo por Tenant
 */
async function createSupply(data, tenantId, user) {
  const { nombre, categoria_id, unidad, proveedor_id, costo, stock, min_stock, has_expiry, expiry_date } = data;
  
  const q = `
    INSERT INTO supplies (
        tenant_id, name, category_id, unit, supplier_id, cost, stock, 
        min_stock, has_expiry, expiry_date, supply_number
    )
    VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        (SELECT COALESCE(MAX(supply_number), 0) + 1 FROM supplies WHERE tenant_id = $1)
    )
    RETURNING 
        id, supply_number, name AS nombre, category_id, unit AS unidad, 
        supplier_id AS proveedor_id, cost AS costo, stock, min_stock, 
        has_expiry, expiry_date, created_at, updated_at
  `;
  
  const values = [
    tenantId, nombre, categoria_id || null, unidad || "UNIDAD", 
    proveedor_id, costo || 0, stock || 0, min_stock || 0, !!has_expiry, expiry_date || null
  ];

  const r = await db.query(q, values, tenantId); 
  const result = r.rows[0];

  if (result && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId, 
      user_id: user.id, 
      user_name: user.name,
      module: 'INVENTARIO', 
      action: 'CREATE_SUPPLY',
      description: `Insumo #${result.supply_number} creado: ${nombre}.`
    });
  }
  
  return result;
}

/**
 * ACTUALIZAR: Mantiene el supply_number intacto
 */
async function updateSupply(id, data, tenantId, user) {
  const { nombre, categoria_id, unidad, proveedor_id, costo, stock, min_stock, has_expiry, expiry_date } = data;
  
  const q = `
    UPDATE supplies SET
      name=$3, category_id=$4, unit=$5, supplier_id=$6, cost=$7, stock=$8,
      min_stock=$9, has_expiry=$10, expiry_date=$11, updated_at=now()
    WHERE id = $1 AND tenant_id = $2
    RETURNING 
        id, supply_number, name AS nombre, category_id, unit AS unidad, 
        supplier_id AS proveedor_id, cost AS costo, stock, min_stock, 
        has_expiry, expiry_date, created_at, updated_at
  `;
  
  const values = [
    id, tenantId, nombre, categoria_id || null, unidad || "UNIDAD", 
    proveedor_id, costo, stock, min_stock || 0, !!has_expiry, expiry_date || null
  ];

  const r = await db.query(q, values, tenantId);
  const result = r.rows[0];

  if (result && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId, 
      user_id: user.id, 
      user_name: user.name,
      module: 'INVENTARIO', 
      action: 'UPDATE_SUPPLY',
      description: `Insumo #${result.supply_number || id} actualizado: ${nombre}`
    });
  }
  
  return result || null;
}

/**
 * ELIMINAR
 */
async function deleteSupply(id, tenantId, user) {
  const q = `DELETE FROM supplies WHERE id = $1 AND tenant_id = $2 RETURNING id`; 
  const r = await db.query(q, [id, tenantId], tenantId);

  if (r.rowCount > 0 && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId, 
      user_id: user.id, 
      user_name: user.name,
      module: 'INVENTARIO', 
      action: 'DELETE_SUPPLY',
      description: `Insumo eliminado ID: ${id}`
    });
  }
  return r.rows[0] || null;
}

/**
 * ACTUALIZAR COSTO Y PROVEEDOR (Usado en compras/producción)
 */
async function updateCostAndSupplier(id, lastCost, supplierId, tenantId) {
  const q = `
    UPDATE supplies 
    SET cost = $3, 
        supplier_id = $4, 
        updated_at = now()
    WHERE id = $1 AND tenant_id = $2
  `;
  const r = await db.query(q, [id, tenantId, lastCost, supplierId], tenantId);
  return r.rowCount > 0;
}

// Exportación única y limpia
module.exports = { 
  listSupplies, 
  getSupplyById, 
  createSupply, 
  updateSupply, 
  deleteSupply,
  updateCostAndSupplier 
};