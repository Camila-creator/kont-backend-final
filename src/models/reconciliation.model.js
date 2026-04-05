// src/models/reconciliation.model.js
// Conciliación bancaria — compatible con extractos CSV/Excel de bancos venezolanos
const db = require("../db");
const audit = require("../controllers/audit.controller");

// ─────────────────────────────────────────────────────────────────────
// LISTAR CONCILIACIONES DEL TENANT
// ─────────────────────────────────────────────────────────────────────
async function listReconciliations(tenantId) {
  const r = await db.query(
    `SELECT br.*,
            fa.name AS account_name,
            fb.name AS bank_name,
            COUNT(bsl.id) AS total_lines,
            COUNT(CASE WHEN bsl.match_status = 'CONCILIADO' THEN 1 END) AS matched_lines,
            COUNT(CASE WHEN bsl.match_status = 'PENDIENTE' THEN 1 END) AS pending_lines
     FROM bank_reconciliations br
     JOIN finance_accounts fa ON fa.id = br.finance_account_id
     LEFT JOIN finance_banks fb ON fb.id = fa.bank_id
     LEFT JOIN bank_statement_lines bsl ON bsl.reconciliation_id = br.id
     WHERE br.tenant_id = $1
     GROUP BY br.id, fa.name, fb.name
     ORDER BY br.start_date DESC`,
    [tenantId], tenantId
  );
  return r.rows;
}

// ─────────────────────────────────────────────────────────────────────
// OBTENER CONCILIACIÓN CON TODAS SUS LÍNEAS
// ─────────────────────────────────────────────────────────────────────
async function getReconciliationById(id, tenantId) {
  const recR = await db.query(
    `SELECT br.*, fa.name AS account_name, fa.currency, fb.name AS bank_name
     FROM bank_reconciliations br
     JOIN finance_accounts fa ON fa.id = br.finance_account_id
     LEFT JOIN finance_banks fb ON fb.id = fa.bank_id
     WHERE br.id = $1 AND br.tenant_id = $2`,
    [id, tenantId], tenantId
  );
  if (!recR.rows[0]) return null;

  const linesR = await db.query(
    `SELECT * FROM bank_statement_lines
     WHERE reconciliation_id = $1 AND tenant_id = $2
     ORDER BY line_date ASC, id ASC`,
    [id, tenantId], tenantId
  );

  return { ...recR.rows[0], lines: linesR.rows };
}

// ─────────────────────────────────────────────────────────────────────
// CREAR CONCILIACIÓN (cabecera)
// ─────────────────────────────────────────────────────────────────────
async function createReconciliation(data, tenantId, user) {
  const { finance_account_id, period_label, start_date, end_date, opening_balance, notes } = data;
  if (!finance_account_id || !start_date || !end_date) {
    throw new Error("Cuenta bancaria, fecha inicio y fecha fin son obligatorios.");
  }

  // Verificar que la cuenta pertenece al tenant
  const accCheck = await db.query(
    `SELECT id FROM finance_accounts WHERE id = $1 AND tenant_id = $2`,
    [finance_account_id, tenantId], tenantId
  );
  if (!accCheck.rows[0]) throw new Error("Cuenta bancaria no encontrada.");

  const r = await db.query(
    `INSERT INTO bank_reconciliations
     (tenant_id, finance_account_id, period_label, start_date, end_date,
      opening_balance, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [tenantId, finance_account_id, period_label || null, start_date, end_date,
     Number(opening_balance || 0), notes || null, user.id],
    tenantId
  );

  await audit.saveAuditLogInternal({ tenant_id: tenantId, user_id: user.id, user_name: user.name,
    module: "CONCILIACION", action: "CREATE",
    description: `Conciliación creada: ${period_label || start_date + " → " + end_date}` });

  return r.rows[0];
}

// ─────────────────────────────────────────────────────────────────────
// IMPORTAR LÍNEAS DEL EXTRACTO BANCARIO (parseadas en el frontend)
// rows: [{ line_date, description, reference, amount }]
// ─────────────────────────────────────────────────────────────────────
async function importStatementLines(reconciliationId, rows, tenantId, user) {
  if (!rows?.length) throw new Error("No hay líneas para importar.");

  // Verificar que la conciliación pertenece al tenant y está abierta
  const recCheck = await db.query(
    `SELECT id, status FROM bank_reconciliations WHERE id = $1 AND tenant_id = $2`,
    [reconciliationId, tenantId], tenantId
  );
  if (!recCheck.rows[0]) throw new Error("Conciliación no encontrada.");
  if (recCheck.rows[0].status === "CERRADO") throw new Error("La conciliación ya está cerrada.");

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.current_tenant_id',$1,true)`, [tenantId.toString()]);

    // Borrar líneas previas si se reimporta
    await client.query(
      `DELETE FROM bank_statement_lines WHERE reconciliation_id = $1 AND tenant_id = $2`,
      [reconciliationId, tenantId]
    );

    let imported = 0;
    for (const row of rows) {
      if (!row.line_date || row.amount == null) continue;
      await client.query(
        `INSERT INTO bank_statement_lines
         (tenant_id, reconciliation_id, line_date, description, reference, amount)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, reconciliationId, row.line_date,
         row.description || null, row.reference || null, Number(row.amount)]
      );
      imported++;
    }

    await client.query("COMMIT");

    await audit.saveAuditLogInternal({ tenant_id: tenantId, user_id: user.id, user_name: user.name,
      module: "CONCILIACION", action: "IMPORT_LINES",
      description: `${imported} líneas importadas a conciliación ID ${reconciliationId}` });

    return { imported };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────
// MATCHING AUTOMÁTICO
// Cruza cada línea PENDIENTE con pagos de clientes, proveedores y gastos
// Criterios: monto exacto + fecha ±5 días
// ─────────────────────────────────────────────────────────────────────
async function runAutoMatch(reconciliationId, tenantId) {
  const lines = await db.query(
    `SELECT * FROM bank_statement_lines
     WHERE reconciliation_id = $1 AND tenant_id = $2 AND match_status = 'PENDIENTE'`,
    [reconciliationId, tenantId], tenantId
  );

  let matched = 0;

  for (const line of lines.rows) {
    const amt = Math.abs(Number(line.amount));
    const isCredit = Number(line.amount) > 0;

    let foundId = null;
    let foundType = null;
    let confidence = 0;

    if (isCredit) {
      // Buscar en pagos de clientes (ingresos)
      const cpR = await db.query(
        `SELECT id FROM customer_payments
         WHERE tenant_id = $1
           AND amount = $2
           AND ABS(paid_at::date - $3::date) <= 5
           AND id NOT IN (
             SELECT matched_payment_id FROM bank_statement_lines
             WHERE reconciliation_id = $4
               AND matched_payment_type = 'customer_payment'
               AND matched_payment_id IS NOT NULL
           )
         ORDER BY ABS(paid_at::date - $3::date) ASC LIMIT 1`,
        [tenantId, amt, line.line_date, reconciliationId], tenantId
      );
      if (cpR.rows[0]) {
        foundId = cpR.rows[0].id;
        foundType = "customer_payment";
        confidence = 90;
      }
    } else {
      // Buscar en pagos a proveedores (egresos)
      const spR = await db.query(
        `SELECT id FROM supplier_payments
         WHERE tenant_id = $1
           AND amount = $2
           AND ABS(paid_at::date - $3::date) <= 5
           AND id NOT IN (
             SELECT matched_payment_id FROM bank_statement_lines
             WHERE reconciliation_id = $4
               AND matched_payment_type = 'supplier_payment'
               AND matched_payment_id IS NOT NULL
           )
         ORDER BY ABS(paid_at::date - $3::date) ASC LIMIT 1`,
        [tenantId, amt, line.line_date, reconciliationId], tenantId
      );
      if (spR.rows[0]) {
        foundId = spR.rows[0].id;
        foundType = "supplier_payment";
        confidence = 90;
      } else {
        // Buscar en gastos
        const expR = await db.query(
          `SELECT id FROM expenses
           WHERE tenant_id = $1
             AND amount = $2
             AND ABS(expense_date - $3::date) <= 5
             AND id NOT IN (
               SELECT matched_payment_id FROM bank_statement_lines
               WHERE reconciliation_id = $4
                 AND matched_payment_type = 'expense'
                 AND matched_payment_id IS NOT NULL
             )
           ORDER BY ABS(expense_date - $3::date) ASC LIMIT 1`,
          [tenantId, amt, line.line_date, reconciliationId], tenantId
        );
        if (expR.rows[0]) {
          foundId = expR.rows[0].id;
          foundType = "expense";
          confidence = 85;
        }
      }
    }

    if (foundId) {
      await db.query(
        `UPDATE bank_statement_lines
         SET match_status = 'CONCILIADO',
             matched_payment_id = $1,
             matched_payment_type = $2,
             match_confidence = $3,
             matched_at = NOW()
         WHERE id = $4 AND tenant_id = $5`,
        [foundId, foundType, confidence, line.id, tenantId], tenantId
      );
      matched++;
    }
  }

  return { matched, total: lines.rows.length };
}

// ─────────────────────────────────────────────────────────────────────
// CONCILIAR MANUALMENTE una línea (vincular a un pago específico)
// ─────────────────────────────────────────────────────────────────────
async function matchLineManual(lineId, paymentId, paymentType, note, tenantId, user) {
  const validTypes = ["customer_payment", "supplier_payment", "expense", "manual"];
  if (!validTypes.includes(paymentType)) throw new Error("Tipo de pago inválido.");

  const r = await db.query(
    `UPDATE bank_statement_lines
     SET match_status = 'CONCILIADO',
         matched_payment_id = $1,
         matched_payment_type = $2,
         match_confidence = 100,
         manual_note = $3,
         matched_by_user = $4,
         matched_at = NOW()
     WHERE id = $5 AND tenant_id = $6
     RETURNING *`,
    [paymentId || null, paymentType, note || null, user.id, lineId, tenantId],
    tenantId
  );
  if (!r.rows[0]) throw new Error("Línea no encontrada.");
  return r.rows[0];
}

// ─────────────────────────────────────────────────────────────────────
// IGNORAR línea (movimiento bancario interno, comisión, etc.)
// ─────────────────────────────────────────────────────────────────────
async function ignoreLine(lineId, note, tenantId) {
  const r = await db.query(
    `UPDATE bank_statement_lines
     SET match_status = 'IGNORADO', manual_note = $1, matched_at = NOW()
     WHERE id = $2 AND tenant_id = $3 RETURNING *`,
    [note || null, lineId, tenantId], tenantId
  );
  if (!r.rows[0]) throw new Error("Línea no encontrada.");
  return r.rows[0];
}

// ─────────────────────────────────────────────────────────────────────
// CERRAR CONCILIACIÓN
// Solo si no quedan líneas PENDIENTES
// ─────────────────────────────────────────────────────────────────────
async function closeReconciliation(id, closingBalance, tenantId, user) {
  const pendR = await db.query(
    `SELECT COUNT(*) AS pending FROM bank_statement_lines
     WHERE reconciliation_id = $1 AND tenant_id = $2 AND match_status = 'PENDIENTE'`,
    [id, tenantId], tenantId
  );
  const pending = Number(pendR.rows[0]?.pending || 0);
  if (pending > 0) {
    throw new Error(`Quedan ${pending} líneas pendientes de conciliar. Resuélvelas antes de cerrar.`);
  }

  const r = await db.query(
    `UPDATE bank_reconciliations
     SET status = 'CERRADO', closing_balance = $1, closed_at = NOW()
     WHERE id = $2 AND tenant_id = $3 RETURNING *`,
    [Number(closingBalance || 0), id, tenantId], tenantId
  );
  if (!r.rows[0]) throw new Error("Conciliación no encontrada.");

  await audit.saveAuditLogInternal({ tenant_id: tenantId, user_id: user.id, user_name: user.name,
    module: "CONCILIACION", action: "CLOSE",
    description: `Conciliación ID ${id} cerrada. Saldo final: $${closingBalance}` });

  return r.rows[0];
}

// ─────────────────────────────────────────────────────────────────────
// LISTAR PAGOS DISPONIBLES PARA MATCH MANUAL
// (pagos del tenant en el rango de fechas de la conciliación)
// ─────────────────────────────────────────────────────────────────────
async function getAvailablePayments(reconciliationId, tenantId) {
  const recR = await db.query(
    `SELECT start_date, end_date FROM bank_reconciliations WHERE id = $1 AND tenant_id = $2`,
    [reconciliationId, tenantId], tenantId
  );
  if (!recR.rows[0]) return {};

  const { start_date, end_date } = recR.rows[0];
  const [cp, sp, ex] = await Promise.all([
    db.query(
      `SELECT cp.id, 'customer_payment' AS type, cp.amount, cp.paid_at AS date,
              cp.method, c.name AS counterpart
       FROM customer_payments cp
       LEFT JOIN customers c ON c.id = cp.customer_id
       WHERE cp.tenant_id = $1 AND cp.paid_at::date BETWEEN $2 AND $3
       ORDER BY cp.paid_at DESC`,
      [tenantId, start_date, end_date], tenantId
    ),
    db.query(
      `SELECT sp.id, 'supplier_payment' AS type, sp.amount, sp.paid_at AS date,
              sp.method, s.nombre AS counterpart
       FROM supplier_payments sp
       LEFT JOIN suppliers s ON s.id = sp.supplier_id
       WHERE sp.tenant_id = $1 AND sp.paid_at::date BETWEEN $2 AND $3
       ORDER BY sp.paid_at DESC`,
      [tenantId, start_date, end_date], tenantId
    ),
    db.query(
      `SELECT id, 'expense' AS type, amount, expense_date AS date,
              payment_method AS method, description AS counterpart
       FROM expenses
       WHERE tenant_id = $1 AND expense_date BETWEEN $2 AND $3
       ORDER BY expense_date DESC`,
      [tenantId, start_date, end_date], tenantId
    ),
  ]);

  return {
    customer_payments: cp.rows,
    supplier_payments: sp.rows,
    expenses: ex.rows,
  };
}


async function revertLine(lineId, tenantId) {
  const r = await db.query(
    `UPDATE bank_statement_lines
     SET match_status        = 'PENDIENTE',
         matched_payment_id  = NULL,
         matched_payment_type= NULL,
         match_confidence    = 0,
         matched_by_user     = NULL,
         matched_at          = NULL,
         manual_note         = NULL
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [lineId, tenantId], tenantId
  );
  if (!r.rows[0]) throw new Error("Línea no encontrada.");
  return r.rows[0];
}

 module.exports = {
   listReconciliations, getReconciliationById, createReconciliation,
   importStatementLines, runAutoMatch, matchLineManual, ignoreLine,
   closeReconciliation, getAvailablePayments, revertLine,
 };