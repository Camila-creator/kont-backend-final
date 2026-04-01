const db = require("../db");

// Constante para verificar el entorno
const IS_PROD = process.env.NODE_ENV === 'production';

module.exports = {
  // Obtener las últimas tasas registradas (USD, EUR, etc.)
  getRates: async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      // Trae la última tasa de cada código de moneda disponible
      const q = `
        SELECT DISTINCT ON (currency_code) 
          id, rate_value, currency_code, effective_date 
        FROM exchange_rates 
        WHERE tenant_id = $1 
        ORDER BY currency_code, effective_date DESC
      `;
      const r = await db.query(q, [tenantId], tenantId);
      
      // También traemos el historial general (últimos 15 cambios) para la tabla
      const qHistory = `
        SELECT id, rate_value, currency_code, effective_date 
        FROM exchange_rates 
        WHERE tenant_id = $1 
        ORDER BY effective_date DESC 
        LIMIT 15
      `;
      const rHistory = await db.query(qHistory, [tenantId], tenantId);

      res.json({ 
        ok: true, 
        latest: r.rows, 
        data: rHistory.rows // El JS de la tabla usa 'data'
      });
    } catch (e) {
      console.error("Error en getRates:", e);
      res.status(500).json({ ok: false, message: IS_PROD ? "Error interno al obtener tasas." : e.message });
    }
  },

  // Registrar una nueva tasa
  updateRate: async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { rate_value, currency_code } = req.body;

      if (!rate_value || rate_value <= 0) {
        // Validación de negocio (400), se mantiene el mensaje explícito
        return res.status(400).json({ ok: false, message: "La tasa debe ser mayor a 0" });
      }

      const q = `
        INSERT INTO exchange_rates (tenant_id, rate_value, currency_code, effective_date) 
        VALUES ($1, $2, $3, NOW()) 
        RETURNING *
      `;
      const r = await db.query(q, [tenantId, rate_value, currency_code || 'USD'], tenantId);
      
      res.json({ ok: true, data: r.rows[0], message: "Tasa actualizada" });
    } catch (e) {
      console.error("Error en updateRate:", e);
      res.status(500).json({ ok: false, message: IS_PROD ? "Error interno al actualizar la tasa." : e.message });
    }
  }
};