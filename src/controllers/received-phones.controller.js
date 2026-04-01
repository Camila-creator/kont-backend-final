// src/controllers/received-phones.controller.js
const model = require("../models/received_phones.model");

// ─────────────────────────────────────────────────────────
// LÓGICA 2 FIX: usar model que usa db.query (con RLS)
// en lugar de db.pool.query directo
// ─────────────────────────────────────────────────────────

exports.getPending = async (req, res) => {
  try {
    // Normalizar tenant_id — puede venir como tenant_id o tenantId
    const tenantId = req.user.tenant_id || req.user.tenantId;
    if (!tenantId) return res.status(401).json({ error: "No se detectó la empresa." });

    const data = await model.listPending(tenantId);
    res.json({ data });
  } catch (error) {
    console.error("Error en getPending:", error.message);
    res.status(500).json({ error: "Error al obtener la lista de equipos." });
  }
};

exports.processIntoInventory = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    if (!tenantId) return res.status(401).json({ error: "No se detectó la empresa." });

    const { id, destination, imei, name, category, cost, price } = req.body;

    // Validaciones básicas
    if (!id) return res.status(400).json({ error: "ID del equipo requerido." });
    if (!destination || !["PRODUCTO", "INSUMO"].includes(destination)) {
      return res.status(400).json({ error: "Destino inválido. Debe ser PRODUCTO o INSUMO." });
    }
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "El nombre del equipo es obligatorio." });
    }
    if (!imei || imei.trim() === "") {
      return res.status(400).json({ error: "El IMEI es obligatorio." });
    }

    const result = await model.processToInventory(
      { id, destination, imei, name, category, price, cost },
      tenantId,
      req.user
    );

    res.json({ message: "Equipo integrado al sistema correctamente.", ...result });
  } catch (error) {
    console.error("Error al procesar equipo:", error.message);
    res.status(500).json({ error: error.message || "No se pudo procesar el equipo." });
  }
};
