const { pool } = require("../db");

// GET /api/expenses - Sin cambios significativos, solo asegúrate de traer los nuevos campos
exports.getExpenses = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { period } = req.query;

        let dateCondition = "";
        if (period === 'monthly') {
            dateCondition = "AND e.expense_date >= date_trunc('month', CURRENT_DATE)";
        } else if (period === 'weekly') {
            dateCondition = "AND e.expense_date >= date_trunc('week', CURRENT_DATE)";
        }

        const query = `
            SELECT 
                e.*, 
                s.nombre as supplier_name, 
                fa.name as account_name
            FROM expenses e
            LEFT JOIN suppliers s ON s.id = e.supplier_id
            LEFT JOIN finance_accounts fa ON fa.id = e.finance_account_id
            WHERE e.tenant_id = $1 ${dateCondition}
            ORDER BY e.expense_date DESC, e.created_at DESC
        `;

        const result = await pool.query(query, [tenantId]);
        res.json({ data: result.rows });
    } catch (error) {
        console.error("❌ ERROR AL CARGAR GASTOS:", error);
        res.status(500).json({ error: "Error al obtener la lista de egresos" });
    }
};

// POST /api/expenses - AQUÍ EL CAMBIO PARA LAS TASAS
exports.createExpense = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.userId;

        const { 
            category, 
            description, 
            amount, 
            date, 
            method, 
            supplier_id, 
            finance_account_id, 
            place,
            currency,        // <--- RECIBIDO DEL JS
            exchange_rate    // <--- RECIBIDO DEL JS
        } = req.body;

        const query = `
            INSERT INTO expenses 
            (
                tenant_id, category, description, amount, expense_date, 
                payment_method, supplier_id, finance_account_id, purchase_place, 
                created_by, currency, exchange_rate
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;

        const values = [
            tenantId, 
            category, 
            description, 
            amount, 
            date, 
            method, 
            supplier_id || null, 
            finance_account_id || null, 
            place || null, 
            userId,
            currency || 'USD',           // Valor por defecto USD
            exchange_rate || 1.0         // Valor por defecto 1.0
        ];

        const result = await pool.query(query, values);

        res.status(201).json({ 
            message: "Egreso registrado correctamente",
            data: result.rows[0] 
        });

    } catch (error) {
        console.error("❌ ERROR AL CREAR GASTO:", error);
        res.status(500).json({ error: "No se pudo registrar el egreso" });
    }
};

// DELETE /api/expenses/:id - Se mantiene igual
exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const result = await pool.query(
            "DELETE FROM expenses WHERE id = $1 AND tenant_id = $2 RETURNING *",
            [id, tenantId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Gasto no encontrado" });
        }

        res.json({ message: "Gasto eliminado exitosamente" });
    } catch (error) {
        console.error("❌ ERROR AL ELIMINAR GASTO:", error);
        res.status(500).json({ error: "Error interno al eliminar" });
    }
};