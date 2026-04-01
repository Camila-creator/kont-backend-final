// src/controllers/users.controller.js
const db = require("../db");
const bcrypt = require("bcryptjs");

const getTenant = (req) => req.user.tenant_id || req.user.tenantId;
const IS_PROD = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────
// GET /api/users — Lista usuarios con nombre de sede
// ─────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.custom_title,
              u.is_coordinator, u.is_active, u.branch_id,
              b.name AS branch_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.tenant_id = $1
       ORDER BY u.id ASC`,
      [tenantId], tenantId
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("Error en getUsers:", err.message);
    res.status(500).json({ error: IS_PROD ? "Error interno." : err.message });
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/users — Crear usuario con validación de plan y branch_id
// ─────────────────────────────────────────────────────────
exports.createUser = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const { name, email, password, role, custom_title, is_coordinator, branch_id } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Nombre, email, contraseña y rol son obligatorios." });
    }

    // Validar límite del plan (max_users)
    const planCheck = await db.query(
      `SELECT p.max_users,
              (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND is_active = true) AS current_users
       FROM tenants t
       JOIN plans p ON t.plan_id = p.id
       WHERE t.id = $1`,
      [tenantId], tenantId
    );

    if (!planCheck.rows.length) {
      return res.status(404).json({ error: "Empresa no encontrada." });
    }

    const { max_users, current_users } = planCheck.rows[0];
    if (Number(current_users) >= Number(max_users)) {
      return res.status(403).json({
        error: `Límite de plan alcanzado (${max_users} usuario${max_users > 1 ? "s" : ""}). Actualiza tu plan para agregar más.`,
        limit: max_users,
        current: Number(current_users),
      });
    }

    // Validar que branch_id (si viene) pertenezca al tenant
    if (branch_id) {
      const branchCheck = await db.query(
        `SELECT id FROM branches WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
        [branch_id, tenantId], tenantId
      );
      if (!branchCheck.rows.length) {
        return res.status(400).json({ error: "La sede seleccionada no existe o no está activa." });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, custom_title, is_coordinator, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, role`,
      [tenantId, name, email, passwordHash, role, custom_title || null, is_coordinator || false, branch_id || null],
      tenantId
    );

    res.status(201).json({ message: "Usuario creado exitosamente.", data: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Este correo ya está registrado en el sistema." });
    }
    console.error("Error en createUser:", err.message);
    res.status(500).json({ error: IS_PROD ? "Error interno." : err.message });
  }
};

// ─────────────────────────────────────────────────────────
// PUT /api/users/:id — Actualizar usuario (incluye branch_id)
// ─────────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const userId = req.params.id;
    const { name, email, password, role, custom_title, is_coordinator, is_active, branch_id } = req.body;

    // Validar branch_id si viene
    if (branch_id !== undefined && branch_id !== null) {
      const branchCheck = await db.query(
        `SELECT id FROM branches WHERE id = $1 AND tenant_id = $2`,
        [branch_id, tenantId], tenantId
      );
      if (!branchCheck.rows.length) {
        return res.status(400).json({ error: "La sede seleccionada no existe." });
      }
    }

    const parts = [];
    const values = [];
    let c = 1;

    if (name !== undefined)           { parts.push(`name = $${c++}`);           values.push(name); }
    if (email !== undefined)          { parts.push(`email = $${c++}`);          values.push(email); }
    if (role !== undefined)           { parts.push(`role = $${c++}`);           values.push(role); }
    if (custom_title !== undefined)   { parts.push(`custom_title = $${c++}`);   values.push(custom_title); }
    if (is_coordinator !== undefined) { parts.push(`is_coordinator = $${c++}`); values.push(is_coordinator); }
    if (is_active !== undefined)      { parts.push(`is_active = $${c++}`);      values.push(is_active); }
    if (branch_id !== undefined)      { parts.push(`branch_id = $${c++}`);      values.push(branch_id); }

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      parts.push(`password_hash = $${c++}`);
      values.push(hash);
    }

    if (!parts.length) {
      return res.status(400).json({ error: "No hay campos para actualizar." });
    }

    values.push(userId, tenantId);
    const result = await db.query(
      `UPDATE users SET ${parts.join(", ")} WHERE id = $${c++} AND tenant_id = $${c++} RETURNING id, name, role, branch_id`,
      values, tenantId
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Usuario no encontrado o sin permiso." });
    }

    res.json({ message: "Usuario actualizado.", data: result.rows[0] });
  } catch (err) {
    console.error("Error en updateUser:", err.message);
    res.status(500).json({ error: IS_PROD ? "Error interno." : err.message });
  }
};
