// src/models/payroll.model.js
// Nómina venezolana — cálculos automáticos de deducciones legales
const db = require("../db");
const audit = require("../controllers/audit.controller");

const IS_PROD = process.env.NODE_ENV === "production";
const getTid = (req) => req?.user?.tenant_id || req?.user?.tenantId;

// ─────────────────────────────────────────────────────────────────────
// CONSTANTES LEGALES VE (actualizables)
// ─────────────────────────────────────────────────────────────────────
const VE_RATES = {
  SSO_EMPLOYEE:   0.04,   // 4% trabajador
  SSO_EMPLOYER:   0.09,   // 9% patrono (11% si >101 trabajadores)
  INCES_EMPLOYEE: 0.005,  // 0.5% trabajador
  INCES_EMPLOYER: 0.02,   // 2% patrono
  FAOV_EMPLOYEE:  0.01,   // 1% trabajador
  FAOV_EMPLOYER:  0.02,   // 2% patrono
};

// ─────────────────────────────────────────────────────────────────────
// EMPLEADOS
// ─────────────────────────────────────────────────────────────────────
async function listEmployees(tenantId) {
  const r = await db.query(
    `SELECT e.*, b.name AS branch_name
     FROM employees e
     LEFT JOIN branches b ON b.id = e.branch_id
     WHERE e.tenant_id = $1
     ORDER BY e.is_active DESC, e.name ASC`,
    [tenantId], tenantId
  );
  return r.rows;
}

async function getEmployeeById(id, tenantId) {
  const r = await db.query(
    `SELECT e.*, b.name AS branch_name
     FROM employees e
     LEFT JOIN branches b ON b.id = e.branch_id
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [id, tenantId], tenantId
  );
  return r.rows[0] || null;
}

async function createEmployee(data, tenantId, user) {
  const { name, id_number, position, department, hire_date, contract_type,
          base_salary, salary_currency, food_bonus, transport_bonus,
          branch_id, phone, email, notes } = data;

  if (!name || !id_number || !hire_date || base_salary == null) {
    throw new Error("Nombre, cédula, fecha de ingreso y salario son obligatorios.");
  }

  const r = await db.query(
    `INSERT INTO employees
     (tenant_id, branch_id, name, id_number, position, department,
      hire_date, contract_type, base_salary, salary_currency,
      food_bonus, transport_bonus, phone, email, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [tenantId, branch_id || null, name, id_number, position || null, department || null,
     hire_date, contract_type || "INDEFINIDO", Number(base_salary),
     salary_currency || "USD", Number(food_bonus || 0), Number(transport_bonus || 0),
     phone || null, email || null, notes || null],
    tenantId
  );
  const emp = r.rows[0];
  await audit.saveAuditLogInternal({ tenant_id: tenantId, user_id: user.id, user_name: user.name,
    module: "NOMINA", action: "CREATE_EMPLOYEE", description: `Empleado creado: ${name}` });
  return emp;
}

async function updateEmployee(id, data, tenantId, user) {
  const fields = [];
  const vals = [];
  let c = 1;
  const allowed = ["name","id_number","position","department","hire_date","contract_type",
                   "base_salary","salary_currency","food_bonus","transport_bonus",
                   "branch_id","phone","email","notes","is_active"];
  allowed.forEach(k => {
    if (data[k] !== undefined) { fields.push(`${k} = $${c++}`); vals.push(data[k]); }
  });
  if (!fields.length) throw new Error("Sin campos para actualizar.");
  fields.push(`updated_at = NOW()`);
  vals.push(id, tenantId);
  const r = await db.query(
    `UPDATE employees SET ${fields.join(", ")} WHERE id = $${c++} AND tenant_id = $${c++} RETURNING *`,
    vals, tenantId
  );
  if (!r.rows[0]) throw new Error("Empleado no encontrado.");
  await audit.saveAuditLogInternal({ tenant_id: tenantId, user_id: user.id, user_name: user.name,
    module: "NOMINA", action: "UPDATE_EMPLOYEE", description: `Empleado actualizado ID ${id}` });
  return r.rows[0];
}

// ─────────────────────────────────────────────────────────────────────
// PERÍODOS DE NÓMINA
// ─────────────────────────────────────────────────────────────────────
async function listPeriods(tenantId) {
  const r = await db.query(
    `SELECT p.*,
            COUNT(i.id) AS items_count,
            COALESCE(SUM(i.net_salary), 0) AS total_net
     FROM payroll_periods p
     LEFT JOIN payroll_items i ON i.period_id = p.id
     WHERE p.tenant_id = $1
     GROUP BY p.id
     ORDER BY p.start_date DESC`,
    [tenantId], tenantId
  );
  return r.rows;
}

async function getPeriodById(id, tenantId) {
  const periodR = await db.query(
    `SELECT * FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId], tenantId
  );
  if (!periodR.rows[0]) return null;
  const itemsR = await db.query(
    `SELECT i.*, e.name AS employee_name, e.id_number, e.position, e.department
     FROM payroll_items i
     JOIN employees e ON e.id = i.employee_id
     WHERE i.period_id = $1 AND i.tenant_id = $2
     ORDER BY e.name ASC`,
    [id, tenantId], tenantId
  );
  return { ...periodR.rows[0], items: itemsR.rows };
}

// ─────────────────────────────────────────────────────────────────────
// CÁLCULO AUTOMÁTICO DE DEDUCCIONES VE
// ─────────────────────────────────────────────────────────────────────
function calcularDeduccionesVE(baseSalary, totalGross) {
  // SSO: 4% del salario normal (solo sueldo base, no cestaticket)
  const sso = Math.round(baseSalary * VE_RATES.SSO_EMPLOYEE * 100) / 100;
  // INCES: 0.5% del salario total (incluyendo asignaciones)
  const inces = Math.round(totalGross * VE_RATES.INCES_EMPLOYEE * 100) / 100;
  // FAOV: 1% del salario integral (sueldo base + alícuotas)
  const faov = Math.round(baseSalary * VE_RATES.FAOV_EMPLOYEE * 100) / 100;
  return { sso, inces, faov, total: sso + inces + faov };
}

// ─────────────────────────────────────────────────────────────────────
// CREAR PERÍODO Y AUTO-GENERAR ITEMS POR TODOS LOS EMPLEADOS ACTIVOS
// ─────────────────────────────────────────────────────────────────────
async function createPeriod(data, tenantId, user) {
  const { period_label, period_type, start_date, end_date, exchange_rate, notes } = data;
  if (!period_label || !start_date || !end_date) {
    throw new Error("Período, fecha inicio y fecha fin son obligatorios.");
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId.toString()]);

    // Crear el período
    const pR = await client.query(
      `INSERT INTO payroll_periods
       (tenant_id, period_label, period_type, start_date, end_date, exchange_rate, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantId, period_label, period_type || "MENSUAL", start_date, end_date,
       Number(exchange_rate || 1), notes || null, user.id]
    );
    const period = pR.rows[0];

    // Cargar empleados activos
    const empR = await client.query(
      `SELECT * FROM employees WHERE tenant_id = $1 AND is_active = true ORDER BY name ASC`,
      [tenantId]
    );

    // Auto-generar un item por cada empleado con sus cálculos base
    for (const emp of empR.rows) {
      const baseSalary = Number(emp.base_salary || 0);
      const foodBonus  = Number(emp.food_bonus || 0);
      const transport  = Number(emp.transport_bonus || 0);
      const grossSalary = baseSalary + foodBonus + transport;
      const ded = calcularDeduccionesVE(baseSalary, grossSalary);
      const netSalary = Math.max(0, grossSalary - ded.total);
      const netBs = Math.round(netSalary * Number(exchange_rate || 1) * 100) / 100;

      await client.query(
        `INSERT INTO payroll_items
         (tenant_id, period_id, employee_id, base_salary, food_bonus, transport_bonus,
          gross_salary, sso_deduction, inces_deduction, faov_deduction,
          total_deductions, net_salary, net_salary_bs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (period_id, employee_id) DO NOTHING`,
        [tenantId, period.id, emp.id, baseSalary, foodBonus, transport,
         grossSalary, ded.sso, ded.inces, ded.faov, ded.total, netSalary, netBs]
      );
    }

    await client.query("COMMIT");
    await audit.saveAuditLogInternal({ tenant_id: tenantId, user_id: user.id, user_name: user.name,
      module: "NOMINA", action: "CREATE_PERIOD",
      description: `Período ${period_label} creado con ${empR.rows.length} empleados.` });

    return period;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────
// ACTUALIZAR ITEM INDIVIDUAL (novedades: horas extras, préstamos, etc.)
// ─────────────────────────────────────────────────────────────────────
async function updatePayrollItem(itemId, data, tenantId, user) {
  // Recalcular automáticamente al actualizar
  const item = await db.query(
    `SELECT pi.*, e.base_salary AS emp_base_salary
     FROM payroll_items pi
     JOIN employees e ON e.id = pi.employee_id
     WHERE pi.id = $1 AND pi.tenant_id = $2`,
    [itemId, tenantId], tenantId
  );
  if (!item.rows[0]) throw new Error("Item no encontrado.");

  const cur = item.rows[0];
  const base    = Number(data.base_salary    ?? cur.base_salary);
  const food    = Number(data.food_bonus     ?? cur.food_bonus);
  const trans   = Number(data.transport_bonus ?? cur.transport_bonus);
  const overAmt = Number(data.overtime_amount ?? cur.overtime_amount);
  const bonuses = Number(data.bonuses        ?? cur.bonuses);
  const otherIn = Number(data.other_income   ?? cur.other_income);
  const loanDed = Number(data.loan_deduction ?? cur.loan_deduction);
  const advDed  = Number(data.advance_deduction ?? cur.advance_deduction);
  const otherDed= Number(data.other_deductions ?? cur.other_deductions);

  const gross = base + food + trans + overAmt + bonuses + otherIn;
  const legalDed = calcularDeduccionesVE(base, gross);
  const totalDed = legalDed.total + loanDed + advDed + otherDed;
  const net = Math.max(0, gross - totalDed);

  // Obtener tasa del período
  const periodR = await db.query(
    `SELECT exchange_rate FROM payroll_periods WHERE id = (
       SELECT period_id FROM payroll_items WHERE id = $1
     )`, [itemId], tenantId
  );
  const rate = Number(periodR.rows[0]?.exchange_rate || 1);
  const netBs = Math.round(net * rate * 100) / 100;

  const r = await db.query(
    `UPDATE payroll_items SET
       base_salary=$1, food_bonus=$2, transport_bonus=$3,
       overtime_hours=$4, overtime_amount=$5, bonuses=$6, other_income=$7,
       gross_salary=$8, sso_deduction=$9, inces_deduction=$10, faov_deduction=$11,
       loan_deduction=$12, advance_deduction=$13, other_deductions=$14,
       total_deductions=$15, net_salary=$16, net_salary_bs=$17,
       notes=$18
     WHERE id=$19 AND tenant_id=$20 RETURNING *`,
    [base, food, trans,
     Number(data.overtime_hours ?? cur.overtime_hours), overAmt, bonuses, otherIn,
     gross, legalDed.sso, legalDed.inces, legalDed.faov,
     loanDed, advDed, otherDed,
     totalDed, net, netBs,
     data.notes ?? cur.notes,
     itemId, tenantId],
    tenantId
  );
  return r.rows[0];
}

// ─────────────────────────────────────────────────────────────────────
// CERRAR PERÍODO (marca como CERRADO, no permite más ediciones)
// ─────────────────────────────────────────────────────────────────────
async function closePeriod(periodId, tenantId, user) {
  const check = await db.query(
    `SELECT status FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
    [periodId, tenantId], tenantId
  );
  if (!check.rows[0]) throw new Error("Período no encontrado.");
  if (check.rows[0].status === "CERRADO") throw new Error("El período ya está cerrado.");

  const r = await db.query(
    `UPDATE payroll_periods
     SET status = 'CERRADO', closed_at = NOW()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [periodId, tenantId], tenantId
  );
  await audit.saveAuditLogInternal({ tenant_id: tenantId, user_id: user.id, user_name: user.name,
    module: "NOMINA", action: "CLOSE_PERIOD",
    description: `Período ID ${periodId} cerrado.` });
  return r.rows[0];
}

module.exports = {
  listEmployees, getEmployeeById, createEmployee, updateEmployee,
  listPeriods, getPeriodById, createPeriod, updatePayrollItem, closePeriod,
  calcularDeduccionesVE, VE_RATES,
};
