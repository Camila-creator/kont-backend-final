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

    // 1. BUSCAR USUARIO
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

    // 4. VALIDAR CONTRASEÑA
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // 5. GENERAR TOKENS (Access y Refresh)
    const secret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET; // Asegúrate de tener esto en tu .env

    if (!secret || !refreshSecret) {
      console.error("CRÍTICO: Secretos de JWT no definidos en .env");
      return res.status(500).json({ error: "Error de configuración del servidor." });
    }

    // Access Token (24h)
    const token = jwt.sign(
      {
        id: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        name: user.name,
        categoryId: user.category_id || 1,
      },
      secret,
      { expiresIn: "24h" }
    );

    // Refresh Token (7 días) - ESTA ES LA MODIFICACIÓN
    const refreshToken = jwt.sign(
      { id: user.id },
      refreshSecret,
      { expiresIn: "7d" }
    );

    // 6. RESPUESTA (Enviando ambos tokens)
    return res.json({
      message: "Login exitoso",
      token,
      refreshToken, // Lo añadimos aquí
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

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token requerido" });
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    
    const decoded = jwt.verify(refreshToken, refreshSecret);

    const userResult = await pool.query(
      `SELECT u.id, u.tenant_id, u.role, u.name, t.category_id 
       FROM users u 
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.is_active = true AND t.is_active = true`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: "Usuario no autorizado o inactivo" });
    }

    const user = userResult.rows[0];

    const newToken = jwt.sign(
      {
        id: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        name: user.name,
        categoryId: user.category_id || 1,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({ token: newToken });

  } catch (error) {
    console.error("Error en refresh token:", error.message);
    return res.status(403).json({ error: "Sesión expirada. Por favor, inicia sesión de nuevo." });
  }
};