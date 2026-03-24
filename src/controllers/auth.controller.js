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

    // 1. Buscar usuario + Datos de la Empresa (Tenant)
    // --- MODIFICADO: Agregamos JOIN para traer category_id ---
    const userResult = await pool.query(
      `SELECT u.*, t.category_id 
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1 AND u.is_active = true AND t.is_active = true`,
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas, usuario inactivo o empresa suspendida" });
    }

    const user = userResult.rows[0];

    // 2. Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // 3. Generar el Token
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        name: user.name,
        categoryId: user.category_id // --- NUEVO: Incluido en el token por seguridad ---
      },
      process.env.JWT_SECRET || "secreto_super_seguro_agromedic_2026",
      { expiresIn: "12h" }
    );

    // 4. Respuesta
    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_category_id: user.category_id // --- NUEVO: Fundamental para el main.js ---
      }
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};