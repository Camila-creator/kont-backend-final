const asyncHandler = require("../utils/asyncHandler");
const db = require("../db");

// Listar categorías del Tenant
exports.list = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const result = await db.query(
        "SELECT id, name, color FROM supply_categories WHERE tenant_id = $1 ORDER BY name ASC",
        [tenantId],
        tenantId
    );
    res.json({ ok: true, data: result.rows });
});

// Crear nueva categoría
exports.create = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { name, color } = req.body;

    if (!name) return res.status(400).json({ ok: false, message: "El nombre es obligatorio" });

    const result = await db.query(
        "INSERT INTO supply_categories (tenant_id, name, color) VALUES ($1, $2, $3) RETURNING *",
        [tenantId, name, color || '#f1f5f9'],
        tenantId
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
});

// Eliminar categoría
exports.remove = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { id } = req.params;

    const result = await db.query(
        "DELETE FROM supply_categories WHERE id = $1 AND tenant_id = $2 RETURNING id",
        [id, tenantId],
        tenantId
    );

    if (result.rowCount === 0) return res.status(404).json({ ok: false, message: "Categoría no encontrada" });
    res.json({ ok: true, message: "Categoría eliminada" });
}); 