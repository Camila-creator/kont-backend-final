const db = require("../db");
const bcrypt = require("bcryptjs");

// Helper para obtener el Tenant ID de forma segura
const getTenant = (req) => req.user.tenant_id || req.user.tenantId;

// Obtener todos los usuarios del Tenant
exports.getUsers = async (req, res) => {
  try {
    const tenantId = getTenant(req);

    // 🛡️ Filtro explícito "WHERE tenant_id = $1" añadido por seguridad
    const result = await db.query(
      `SELECT id, name, email, role, custom_title, is_coordinator, is_active 
       FROM users 
       WHERE tenant_id = $1
       ORDER BY id ASC`,
      [tenantId], 
      tenantId 
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear un nuevo usuario
exports.createUser = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const { name, email, password, role, custom_title, is_coordinator } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // --- 🛡️ VALIDACIÓN DE LÍMITE DE PLAN ---
    const planCheck = await db.query(
      `SELECT p.max_users, 
              (SELECT COUNT(*) FROM users WHERE tenant_id = $1) as current_users
       FROM tenants t
       JOIN plans p ON t.plan_id = p.id
       WHERE t.id = $1`,
      [tenantId]
    );

    const { max_users, current_users } = planCheck.rows[0];

    // Si max_users es 0 o null, podrías considerarlo ilimitado, 
    // pero aquí asumimos que siempre hay un número.
    if (current_users >= max_users) {
      return res.status(403).json({ 
        error: `Has alcanzado el límite de tu plan (${max_users} usuarios). Por favor, mejora tu plan.` 
      });
    }
    // --- FIN VALIDACIÓN ---

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users 
       (tenant_id, name, email, password_hash, role, custom_title, is_coordinator) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [tenantId, name, email, passwordHash, role, custom_title, is_coordinator || false]
    );

    res.status(201).json({ message: "Usuario creado", id: result.rows[0].id });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Este correo ya está registrado." });
    }
    res.status(500).json({ error: error.message });
  }
};

// Actualizar un usuario existente
exports.updateUser = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const userId = req.params.id;
    const { name, email, password, role, custom_title, is_coordinator, is_active } = req.body;

    let queryStr = "UPDATE users SET ";
    const values = [];
    let counter = 1;

    if (name !== undefined) { queryStr += `name = $${counter++}, `; values.push(name); }
    if (email !== undefined) { queryStr += `email = $${counter++}, `; values.push(email); }
    if (role !== undefined) { queryStr += `role = $${counter++}, `; values.push(role); }
    if (custom_title !== undefined) { queryStr += `custom_title = $${counter++}, `; values.push(custom_title); }
    if (is_coordinator !== undefined) { queryStr += `is_coordinator = $${counter++}, `; values.push(is_coordinator); }
    if (is_active !== undefined) { queryStr += `is_active = $${counter++}, `; values.push(is_active); }
    
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      queryStr += `password_hash = $${counter++}, `; 
      values.push(passwordHash);
    }

    queryStr = queryStr.slice(0, -2);
    
    // 🛡️ Filtro de seguridad: Solo permite actualizar si el ID coincide Y pertenece al mismo Tenant
    queryStr += ` WHERE id = $${counter++} AND tenant_id = $${counter++}`; 
    values.push(userId);
    values.push(tenantId);

    const result = await db.query(queryStr, values, tenantId);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado o no tienes permiso." });
    }

    res.json({ message: "Usuario actualizado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};