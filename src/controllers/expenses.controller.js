// src/controllers/expenses.controller.js
// LÓGICA 2 FIX: reemplazado pool.query por db.query (respeta RLS y aislamiento multi-tenant)
const db = require("../db");
const audit = require("./audit.controller");

exports.getExpenses = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const { period } = req.query;

    // Condición de fecha — solo valores permitidos, no viene del usuario directo
    let dateCondition = "";
    if (period === "monthly") {
      dateCondition = "AND e.expense_date >= date_trunc('month', CURRENT_DATE)";
    } else if (period === "weekly") {
      dateCondition = "AND e.expense_date >= date_trunc('week', CURRENT_DATE)";
    }
    // Cualquier otro valor simplemente no filtra por fecha — seguro

    const query = `
      SELECT 
        e.*, 
        s.nombre AS supplier_name,
        fa.name AS account_name
      FROM expenses e
      LEFT JOIN suppliers s ON s.id = e.supplier_id
      LEFT JOIN finance_accounts fa ON fa.id = e.finance_account_id
      WHERE e.tenant_id = $1 ${dateCondition}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `;

    const result = await db.query(query, [tenantId], tenantId);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error al cargar gastos:", error.message);
    res.status(500).json({ error: "Error al obtener la lista de egresos" });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const userId = req.user.id || req.user.userId;
    const userName = req.user.name || "Usuario Kont";

    const {
      category, description, amount, date, method,
      supplier_id, finance_account_id, place,
      currency, exchange_rate,
    } = req.body;

    if (!category || !description || !amount) {
      return res.status(400).json({ error: "Categoría, descripción y monto son obligatorios." });
    }

    const query = `
      INSERT INTO expenses (
        tenant_id, category, description, amount, expense_date,
        payment_method, supplier_id, finance_account_id,
        purchase_place, currency, exchange_rate, created_by
      )
      VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8, $9,
              COALESCE($10, 'USD'), COALESCE($11, 1.0), $12)
      RETURNING *
    `;

    const values = [
      tenantId, category, description, amount, date || null,
      method || null, supplier_id || null, finance_account_id || null,
      place || null, currency || "USD", exchange_rate || 1.0, userId,
    ];

    const result = await db.query(query, values, tenantId);
    const expense = result.rows[0];

    await audit.saveAuditLogInternal({
      tenant_id: tenantId, user_id: userId, user_name: userName,
      module: "FINANZAS", action: "CREATE_EXPENSE",
      description: `Gasto registrado: ${description} — $${amount}`,
    });

    res.status(201).json({ data: expense });
  } catch (error) {
    console.error("Error al crear gasto:", error.message);
    res.status(500).json({ error: "Error al registrar el gasto" });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM expenses WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId],
      tenantId
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Gasto no encontrado o sin permiso." });
    }

    res.json({ ok: true, deleted: id });
  } catch (error) {
    console.error("Error al eliminar gasto:", error.message);
    res.status(500).json({ error: "Error al eliminar el gasto" });
  }
};
