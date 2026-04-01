// src/controllers/branches.controller.js
const db = require("../db");
const audit = require("./audit.controller");

const getTenant = (req) => req.user.tenant_id || req.user.tenantId;
const IS_PROD = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────
// GET /api/branches — Listar sedes del tenant
// ─────────────────────────────────────────────────────────
exports.getBranches = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const result = await db.query(
      `SELECT b.id, b.name, b.address, b.phone, b.is_active, b.created_at,
              COUNT(u.id) AS user_count
       FROM branches b
       LEFT JOIN users u ON u.branch_id = b.id AND u.is_active = true
       WHERE b.tenant_id = $1
       GROUP BY b.id
       ORDER BY b.id ASC`,
      [tenantId], tenantId
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("Error en getBranches:", err.message);
    res.status(500).json({ error: IS_PROD ? "Error interno." : err.message });
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/branches — Crear sede con validación de plan
// ─────────────────────────────────────────────────────────
exports.createBranch = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const { name, address, phone } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "El nombre de la sede es obligatorio." });
    }

    // Validar límite del plan
    const planCheck = await db.query(
      `SELECT p.max_branches,
              (SELECT COUNT(*) FROM branches WHERE tenant_id = $1) AS current_branches
       FROM tenants t
       JOIN plans p ON t.plan_id = p.id
       WHERE t.id = $1`,
      [tenantId], tenantId
    );

    if (!planCheck.rows.length) {
      return res.status(404).json({ error: "Empresa no encontrada." });
    }

    const { max_branches, current_branches } = planCheck.rows[0];

    if (Number(current_branches) >= Number(max_branches)) {
      return res.status(403).json({
        error: `Límite de plan alcanzado (${max_branches} sede${max_branches > 1 ? "s" : ""}). Actualiza tu plan para agregar más.`,
        limit: max_branches,
        current: Number(current_branches),
      });
    }

    const result = await db.query(
      `INSERT INTO branches (tenant_id, name, address, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, address, phone, is_active, created_at`,
      [tenantId, name.trim(), address || null, phone || null],
      tenantId
    );

    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: req.user.id,
      user_name: req.user.name,
      module: "GESTION",
      action: "CREATE_BRANCH",
      description: `Sede "${name}" creada.`,
    });

    res.status(201).json({ message: "Sede creada exitosamente.", data: result.rows[0] });
  } catch (err) {
    console.error("Error en createBranch:", err.message);
    res.status(500).json({ error: IS_PROD ? "Error interno." : err.message });
  }
};

// ─────────────────────────────────────────────────────────
// PUT /api/branches/:id — Actualizar sede
// ─────────────────────────────────────────────────────────
exports.updateBranch = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const { id } = req.params;
    const { name, address, phone, is_active } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "El nombre de la sede es obligatorio." });
    }

    const result = await db.query(
      `UPDATE branches
       SET name = $1, address = $2, phone = $3, is_active = COALESCE($4, is_active)
       WHERE id = $5 AND tenant_id = $6
       RETURNING id, name, address, phone, is_active`,
      [name.trim(), address || null, phone || null, is_active, id, tenantId],
      tenantId
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Sede no encontrada o sin permiso." });
    }

    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: req.user.id,
      user_name: req.user.name,
      module: "GESTION",
      action: "UPDATE_BRANCH",
      description: `Sede "${name}" actualizada.`,
    });

    res.json({ message: "Sede actualizada.", data: result.rows[0] });
  } catch (err) {
    console.error("Error en updateBranch:", err.message);
    res.status(500).json({ error: IS_PROD ? "Error interno." : err.message });
  }
};

// ─────────────────────────────────────────────────────────
// DELETE /api/branches/:id — Desactivar sede (nunca borrar)
// No se permite borrar si tiene usuarios activos asignados
// ─────────────────────────────────────────────────────────
exports.deleteBranch = async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const { id } = req.params;

    // No borrar si tiene usuarios activos
    const usersCheck = await db.query(
      `SELECT COUNT(*) AS total FROM users
       WHERE branch_id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId], tenantId
    );

    if (Number(usersCheck.rows[0].total) > 0) {
      return res.status(400).json({
        error: `No puedes eliminar esta sede porque tiene ${usersCheck.rows[0].total} usuario(s) activo(s) asignado(s). Reasígnalos primero.`,
      });
    }

    // Desactivar en lugar de borrar físicamente
    const result = await db.query(
      `UPDATE branches SET is_active = false
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, name`,
      [id, tenantId], tenantId
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Sede no encontrada o sin permiso." });
    }

    await audit.saveAuditLogInternal({
      tenant_id: tenantId,
      user_id: req.user.id,
      user_name: req.user.name,
      module: "GESTION",
      action: "DELETE_BRANCH",
      description: `Sede "${result.rows[0].name}" desactivada.`,
    });

    res.json({ message: "Sede desactivada correctamente." });
  } catch (err) {
    console.error("Error en deleteBranch:", err.message);
    res.status(500).json({ error: IS_PROD ? "Error interno." : err.message });
  }
};
