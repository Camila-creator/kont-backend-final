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

    // 1. BUSCAR USUARIO — usamos pool directo (sin RLS) para que el login siempre funcione
    const userResult = await pool.query(
      `SELECT u.*, t.category_id, t.is_active AS tenant_active
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(TRIM(u.email)) = $1`,
      [cleanEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = userResult.rows[0];

    // 2. VERIFICAR QUE LA EMPRESA ESTÉ ACTIVA
    if (!user.tenant_active) {
      return res.status(403).json({ error: "Tu empresa no está activa. Contacta a soporte." });
    }

    // 3. VERIFICAR QUE EL USUARIO ESTÉ ACTIVO
    if (!user.is_active) {
      return res.status(403).json({ error: "Tu usuario está desactivado. Contacta al administrador." });
    }

    // 4. VALIDAR CONTRASEÑA con bcrypt — sin excepciones ni bypass
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // 5. GENERAR TOKEN — JWT_SECRET debe existir en .env, sin fallback inseguro
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("CRÍTICO: JWT_SECRET no está definido en las variables de entorno.");
      return res.status(500).json({ error: "Error de configuración del servidor." });
    }

    const token = jwt.sign(
  {
    id: user.id,          // Cambia userId por id para ser consistente
    tenantId: user.tenant_id,
    role: user.role,      // <--- ESTE ES EL REY
    name: user.name,
    categoryId: user.category_id || 1,
  },
  secret,
  { expiresIn: "24h" }
);

    // 6. RESPUESTA
    return res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_category_id: user.category_id || 1,
      },
    });

  } catch (error) {
    console.error("Error en login:", error.message);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};
