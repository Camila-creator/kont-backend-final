const db = require("../db");
const audit = require("../controllers/audit.controller");

/**
 * LISTAR: Genera un display_id que empieza en 1 para cada cliente
 */
async function listSuppliers(tenantId) {
  const q = `
    SELECT *, 
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) as display_id 
    FROM suppliers 
    WHERE tenant_id = $1
    ORDER BY created_at DESC
  `;
  const r = await db.query(q, [tenantId], tenantId);
  return r.rows;
}

/**
 * OBTENER UNO
 */
async function getSupplierById(id, tenantId) {
  const q = `SELECT * FROM suppliers WHERE id=$1 AND tenant_id=$2`;
  const r = await db.query(q, [id, tenantId], tenantId);
  return r.rows[0];
}

/**
 * CREAR: Incluye RIF, Contacto y Condiciones de Pago
 */
async function createSupplier(data, user) {
  const { 
    tenant_id, rif, nombre, contacto, 
    telefono, email, ubicacion, 
    condiciones_pago, notas 
  } = data;

  const q = `
    INSERT INTO suppliers (
      tenant_id, rif, nombre, contacto, 
      telefono, email, ubicacion, 
      condiciones_pago, notas
    ) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
    RETURNING *
  `;
  
  const values = [
    tenant_id, rif, nombre, contacto, 
    telefono, email, ubicacion, 
    condiciones_pago, notas
  ];

  const r = await db.query(q, values, tenant_id);
  
  if (r.rows[0] && user) {
    await audit.saveAuditLogInternal({
      tenant_id, 
      user_id: user.id, 
      user_name: user.name,
      module: 'COMPRAS', 
      action: 'CREATE_SUPPLIER',
      description: `Proveedor creado: ${nombre} (RIF: ${rif})`
    });
  }
  return r.rows[0];
}

/**
 * ACTUALIZAR
 */
async function updateSupplier(id, data, tenantId, user) {
  const { 
    rif, nombre, contacto, telefono, 
    email, ubicacion, condiciones_pago, notas 
  } = data;

  const q = `
    UPDATE suppliers 
    SET rif=$3, nombre=$4, contacto=$5, telefono=$6, 
        email=$7, ubicacion=$8, condiciones_pago=$9, 
        notas=$10, updated_at=now() 
    WHERE id=$1 AND tenant_id=$2 
    RETURNING *
  `;

  const values = [
    id, tenantId, rif, nombre, contacto, 
    telefono, email, ubicacion, condiciones_pago, notas
  ];

  const r = await db.query(q, values, tenantId);
  
  if (r.rows[0] && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId, 
      user_id: user.id, 
      user_name: user.name,
      module: 'COMPRAS', 
      action: 'UPDATE_SUPPLIER',
      description: `Proveedor actualizado: ${nombre} (ID: ${id})`
    });
  }
  return r.rows[0];
}

/**
 * ELIMINAR
 */
async function deleteSupplier(id, tenantId, user) {
  const r = await db.query(
    `DELETE FROM suppliers WHERE id=$1 AND tenant_id=$2 RETURNING *`, 
    [id, tenantId], 
    tenantId
  );

  if (r.rowCount > 0 && user) {
    await audit.saveAuditLogInternal({
      tenant_id: tenantId, 
      user_id: user.id, 
      user_name: user.name,
      module: 'COMPRAS', 
      action: 'DELETE_SUPPLIER',
      description: `Proveedor eliminado ID: ${id}`
    });
  }
  return r.rows[0] || null;
}

module.exports = { 
  listSuppliers, 
  getSupplierById, 
  createSupplier, 
  updateSupplier, 
  deleteSupplier 
};