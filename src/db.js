// backend/db.js
const { Pool } = require("pg");
const { databaseUrl } = require("./config");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // 🛡️ ESTO ES LO QUE FALTA PARA EL ERROR DE SSL:
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false 
});

pool.on("connect", () => {
  console.log("🟢 Conexión física a PostgreSQL establecida");
});

pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de Postgres", err);
});

/**
 * Función de consulta Maestra con Aislamiento RLS Obligatorio
 */
const query = async (text, params = [], tenantId = null) => {
  
  // 1. 🛡️ VALIDACIÓN DE SEGURIDAD
  if (!tenantId) {
    console.error("🚨 [BLOQUEO] Intento de consulta sin Tenant ID.");
    throw new Error("ACCESO_DENEGADO_NO_TENANT");
  }

  const client = await pool.connect();

  try {
    // 2. 🔑 ACTIVAR EL CANDADO (RLS) DENTRO DE UNA TRANSACCIÓN
    await client.query('BEGIN'); 
    
    // Configuramos el ID del tenant para esta transacción específica
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId.toString()]);
    
    // 3. 📝 EJECUTAR CONSULTA
    const res = await client.query(text, params);
    
    await client.query('COMMIT'); 
    return res;

  } catch (err) {
    // Si algo sale mal, revertimos la transacción
    // Agregamos un chequeo por si el error fue al conectar
    if (client) await client.query('ROLLBACK');
    
    console.error("❌ --- ERROR EN BASE DE DATOS --- ❌");
    console.error("Mensaje:", err.message);
    throw err; 

  } finally {
    // 4. 🔓 LIBERAR CONEXIÓN AL POOL
    client.release();
  }
};

module.exports = {
  pool,
  query,
};