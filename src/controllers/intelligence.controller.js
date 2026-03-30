const db = require("../db");
const audit = require("./audit.controller");

exports.getStrategicDashboard = async (req, res) => {
  try {
    const { tenant_id, id: user_id, name: user_name } = req.user;

    // 1. THROUGHPUT (Ventas Netas)
    const salesQ = `
      SELECT 
        COALESCE(SUM(oi.total) - SUM(DISTINCT o.discount_amount), 0) as throughput
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.tenant_id = $1 AND o.status = 'CONFIRMADO'
    `;

    // 2. OPERATING EXPENSES (OE) - La suma de TODO lo que sale
    // Compras de inventario + Gastos operativos (alquiler, servicios, etc)
    const oeQ = `
      SELECT (
        (SELECT COALESCE(SUM(pi.total), 0) 
         FROM purchases p 
         JOIN purchase_items pi ON p.id = pi.purchase_id 
         WHERE p.tenant_id = $1 AND p.status != 'BORRADOR') 
        +
        (SELECT COALESCE(SUM(amount), 0) 
         FROM expenses 
         WHERE tenant_id = $1)
      ) as total_oe
    `;

    // 3. CAJA REAL (El balance neto en los bolsillos)
    // Entradas (Pagos Clientes) - Salidas (Pagos Prov + Gastos Generales)
    const financeQ = `
      SELECT 
        COALESCE(SUM(
          (SELECT COALESCE(SUM(amount), 0) FROM customer_payments WHERE finance_account_id = a.id AND tenant_id = $1) -
          (SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE finance_account_id = a.id AND tenant_id = $1) -
          (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE finance_account_id = a.id AND tenant_id = $1)
        ), 0) AS total_cash_on_hand
      FROM finance_accounts a
      WHERE a.tenant_id = $1 AND a.is_active = true
    `;

    // 4. INVENTARIO & ALERTAS
    const inventoryQ = `
      SELECT 
        COALESCE(SUM(stock * buy_cost), 0) as inventory_investment,
        COUNT(*) FILTER (WHERE stock <= min_stock) as bottlenecks,
        (SELECT COUNT(*) FROM purchases WHERE tenant_id = $1 AND condition = 'CREDITO' AND status != 'PAGADO') as pending_debts
      FROM products
      WHERE tenant_id = $1
    `;

    const [sales, oe, finance, inventory] = await Promise.all([
      db.query(salesQ, [tenant_id], tenant_id),
      db.query(oeQ, [tenant_id], tenant_id),
      db.query(financeQ, [tenant_id], tenant_id),
      db.query(inventoryQ, [tenant_id], tenant_id)
    ]);

    const results = {
      throughput: parseFloat(sales.rows[0].throughput),
      operating_expenses: parseFloat(oe.rows[0].total_oe),
      cash_flow: parseFloat(finance.rows[0].total_cash_on_hand),
      inventory_value: parseFloat(inventory.rows[0].inventory_investment),
      efficiency_ratio: 0, // Se calcula abajo
      alerts: {
        bottlenecks: parseInt(inventory.rows[0].bottlenecks),
        pending_payments: parseInt(inventory.rows[0].pending_debts)
      }
    };

    // Cálculo de eficiencia: ¿Cuánto OE necesitas para generar $1 de T?
    if (results.throughput > 0) {
        results.efficiency_ratio = (results.operating_expenses / results.throughput).toFixed(2);
    }

    await audit.saveAuditLogInternal({
      tenant_id, user_id, user_name,
      module: 'INTELLIGENCE',
      action: 'STRATEGIC_SCAN',
      description: `Dashboard generado. T: $${results.throughput} | OE: $${results.operating_expenses}`
    });

    res.json(results);

  } catch (error) {
    console.error("❌ Error en Kont Intelligence:", error.message);
    res.status(500).json({ error: "Error al procesar la inteligencia de negocio." });
  }
};