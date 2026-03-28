const db = require("../db"); 
const bcrypt = require("bcryptjs");

// Función para calcular próximo pago (Tu lógica original intacta)
function calculateNextPayment(startDateStr, planType) {
  if (planType === 'LIFETIME') return null; 
  const date = new Date(startDateStr);
  if (planType === 'SEMANAL') date.setDate(date.getDate() + 7);
  if (planType === 'MENSUAL') date.setMonth(date.getMonth() + 1);
  if (planType === 'TRIMESTRAL') date.setMonth(date.getMonth() + 3);
  if (planType === 'SEMESTRAL') date.setMonth(date.getMonth() + 6);
  if (planType === 'ANUAL') date.setFullYear(date.getFullYear() + 1);
  return date;
}

exports.getTenants = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Acceso denegado." });

    // DISTINCT ON asegura que aunque la empresa tenga 2 administradores, 
    // en tu tabla del Súper Admin solo salga 1 vez.
    const result = await db.pool.query(`
      SELECT DISTINCT ON (t.id)
        t.*, 
        c.name AS category_name,
        p.name AS plan_name, p.max_users, p.max_branches,
        u.name AS owner_name, u.email AS owner_email
      FROM tenants t
      LEFT JOIN business_categories c ON t.category_id = c.id
      LEFT JOIN plans p ON t.plan_id = p.id
      LEFT JOIN users u ON t.id = u.tenant_id AND (u.role = 'ADMIN_BRAND' OR u.role = 'SUPER_ADMIN')
      ORDER BY t.id ASC
    `); 
    
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error en getTenants:", error);
    res.status(500).json({ error: "Error al obtener las empresas." });
  }
};

exports.createTenant = async (req, res) => {
  
  const client = await db.pool.connect(); 
  try {
    if (req.user.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Acceso denegado." });

    // Agrega esto al inicio de createTenant
const { 
    tenant_name, owner_name, owner_email, owner_password, 
    plan_type, start_date, rif, address, phone, instagram, category_id,
    plan_id 
} = req.body;

// Elimina cualquier intento de enviar un ID manualmente
delete req.body.id;

    if (!tenant_name || !owner_name || !owner_email || !owner_password || !plan_type || !start_date || !category_id) {
      return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    const nextPaymentDate = calculateNextPayment(start_date, plan_type);
    const passwordHash = await bcrypt.hash(owner_password, 10);

    await client.query("BEGIN");

    // 1. Insertar la Empresa (Tenant)
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, plan_type, start_date, next_payment_date, rif, address, phone, instagram, category_id, plan_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [tenant_name, plan_type, start_date, nextPaymentDate, rif, address, phone, instagram, category_id, plan_id || 1]
    );
    // Tu lógica perfecta de captura de ID:
    const newTenantId = tenantResult.rows[0].id;

    // 2. CREACIÓN AUTOMÁTICA DE SEDE PRINCIPAL
    const branchResult = await client.query(
      `INSERT INTO branches (tenant_id, name, address, phone) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [newTenantId, 'Sede Principal', address || 'Sede inicial', phone || '']
    );
    const mainBranchId = branchResult.rows[0].id;

    // 3. Crear al Administrador vinculado a esa Sede Principal
    await client.query(
      `INSERT INTO users (tenant_id, branch_id, name, email, password_hash, role, custom_title, is_coordinator) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [newTenantId, mainBranchId, owner_name, owner_email, passwordHash, 'ADMIN_BRAND', 'Director General', true]
    );

    await client.query("COMMIT");
    res.status(201).json({ message: "Empresa, Sede y Dueño creados exitosamente." });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en createTenant:", error);
    if (error.code === '23505') return res.status(400).json({ error: "El correo del dueño ya existe." });
    res.status(500).json({ error: "Error interno al crear la empresa." });
  } finally {
    client.release();
  }
};

exports.updateTenant = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Acceso denegado." });
    
    // Aquí solo agregué plan_type a tu destructuring para que se actualice junto con el plan_id
    const { name, rif, address, phone, instagram, category_id, plan_id, plan_type } = req.body;
    
    await db.pool.query(
        `UPDATE tenants 
         SET name = $1, rif = $2, address = $3, phone = $4, instagram = $5, category_id = $6, plan_id = $7, plan_type = $8 
         WHERE id = $9`, 
        [name, rif, address, phone, instagram, category_id, plan_id, plan_type, req.params.id]
    );
    
    res.json({ message: "Empresa y Plan actualizados correctamente" });
  } catch (error) {
    console.error("Error en updateTenant:", error);
    res.status(500).json({ error: error.message });
  }
};

// ¡TU FUNCIÓN RESTAURADA EXACTAMENTE COMO LA TENÍAS!
exports.toggleTenantStatus = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Acceso denegado." });
    if (Number(req.params.id) === 1) return res.status(400).json({ error: "No puedes suspender el núcleo del SaaS." });
    
    const { is_active } = req.body;
    
    await db.pool.query("UPDATE tenants SET is_active = $1 WHERE id = $2", [is_active, req.params.id]);
    
    res.json({ message: "Estado actualizado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};