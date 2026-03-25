// backend/controllers/auth.controller.js
const { pool } = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Faltan datos (email o password)" });
    }

    const cleanEmail = email.toLowerCase().trim();
    console.log("--- INTENTO DE LOGIN ---");
    console.log("Email recibido:", cleanEmail);

    // 1. BUSQUEDA PURA (Sin JOIN ni filtros de activo para debuguear)
    // Queremos saber si el usuario existe antes de que el JOIN lo "mate"
    const userOnly = await pool.query(
      `SELECT * FROM users WHERE LOWER(TRIM(email)) = $1`,
      [cleanEmail]
    );

    console.log("¿Usuario encontrado en tabla users?:", userOnly.rows.length > 0);

    if (userOnly.rows.length === 0) {
      console.log("❌ ERROR: El email no existe en la base de datos.");
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = userOnly.rows[0];
    console.log("Rol detectado:", user.role); // AQUÍ DEBE DECIR SUPER_ADMIN
    console.log("ID de Empresa (tenant_id) en usuario:", user.tenant_id);

    // 2. VERIFICACIÓN DEL TENANT (POR SEPARADO)
    const tenantResult = await pool.query(
      `SELECT * FROM tenants WHERE id = $1`,
      [user.tenant_id]
    );

    console.log("¿Existe la empresa en tabla tenants?:", tenantResult.rows.length > 0);
    
    if (tenantResult.rows.length > 0) {
        console.log("Estado de empresa (is_active):", tenantResult.rows[0].is_active);
        console.log("Categoría de empresa (category_id):", tenantResult.rows[0].category_id);
    }

    // 3. VALIDACIÓN DE CONTRASEÑA
    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log("¿Contraseña coincide con Bcrypt?:", isValid);

    if (!isValid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // 4. GENERAR TOKEN
    // Usamos el category_id que venga del tenant o 1 por defecto para no romper el main.js
    const categoryId = tenantResult.rows[0]?.category_id || 1;

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        name: user.name,
        categoryId: categoryId
      },
      process.env.JWT_SECRET || "secreto_super_seguro_agromedic_2026",
      { expiresIn: "12h" }
    );

    console.log("✅ LOGIN EXITOSO para:", user.name);

    // 5. RESPUESTA
    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_category_id: categoryId
      }
    });

  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN LOGIN:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};