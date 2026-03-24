// backend/models/mkt_results.model.js
const db = require("../db");

async function getFinancialData(startDate, endDate, tenantId) {
  try {
    // 1. Ingresos por Ventas (Pagos de clientes) - Agregado tenant_id
    const qVentas = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM customer_payments 
      WHERE paid_at >= $1 AND paid_at <= $2 AND tenant_id = $3
    `;
    const ingresos = parseFloat((await db.query(qVentas, [startDate, endDate, tenantId], tenantId)).rows[0].total);

    // 2. Gastos en Actividades Offline - Agregado tenant_id
    const qOffline = `
      SELECT COALESCE(SUM(gasto_real), 0) as total 
      FROM mkt_offline_activities 
      WHERE fecha_inicio >= $1 AND fecha_inicio <= $2 AND tenant_id = $3
    `;
    const offline = parseFloat((await db.query(qOffline, [startDate, endDate, tenantId], tenantId)).rows[0].total);

    // 3. Gastos en Influencers - Agregado tenant_id
    const qInf = `
      SELECT COALESCE(SUM(inversion), 0) as total 
      FROM mkt_influencers 
      WHERE fecha_inicio >= $1 AND fecha_inicio <= $2 AND tenant_id = $3
    `;
    const influencers = parseFloat((await db.query(qInf, [startDate, endDate, tenantId], tenantId)).rows[0].total);

    // 4. Gastos en Ads - Agregado tenant_id
    const qAds = `
      SELECT COALESCE(SUM(presupuesto_diario * 30), 0) as total 
      FROM mkt_ads_campaigns 
      WHERE fecha_inicio >= $1 AND fecha_inicio <= $2 AND tenant_id = $3
    `;
    const ads = parseFloat((await db.query(qAds, [startDate, endDate, tenantId], tenantId)).rows[0].total);

    // 5. Métricas de Engagement - Agregado tenant_id
    const qMetrics = `
      SELECT * FROM mkt_monthly_metrics 
      WHERE tenant_id = $1
      ORDER BY id DESC LIMIT 1
    `;
    const metrics = (await db.query(qMetrics, [tenantId], tenantId)).rows[0] || {};

    return {
      ingresos: ingresos,
      gastos: offline + influencers + ads,
      distribucion: { ads: ads, offline: offline, influencers: influencers },
      topPerformers: {
        seguidores: metrics.nuevos_seguidores || 0,
        influencer: { nombre: metrics.top_influencer || 'N/A', metrica: metrics.top_influencer_metric || '-' },
        campana: { nombre: metrics.top_campana || 'N/A', metrica: metrics.top_campana_metric || '-' },
        post: { nombre: metrics.top_post || 'N/A', metrica: metrics.top_post_metric || '-' },
        persona: { nombre: metrics.top_persona || 'N/A', metrica: metrics.top_persona_metric || '-' }
      }
    };
  } catch (error) { 
    throw error; 
  }
}

module.exports = { getFinancialData };