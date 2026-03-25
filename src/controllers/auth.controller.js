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
    console.log("--- INTENTO DE LOGIN SEGURO ---");
    console.log("Email recibido:", cleanEmail);

    // 1. BUSQUEDA PURA
    const userOnly = await pool.query(
      `SELECT * FROM users WHERE LOWER(TRIM(email)) = $1`,
      [cleanEmail]
    );

    if (userOnly.rows.length === 0) {
      console.log("❌ ERROR: Usuario no encontrado en DB.");
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = userOnly.rows[0];

    // 2. VERIFICACIÓN DEL TENANT
    const tenantResult = await pool.query(
      `SELECT * FROM tenants WHERE id = $1`,
      [user.tenant_id]
    );

    if (tenantResult.rows.length === 0) {
      console.log("❌ ERROR: La empresa del usuario no existe.");
      return res.status(401).json({ error: "Empresa no encontrada o inactiva" });
    }
    
    // 3. VALIDACIÓN DE CONTRASEÑA (RESTAURADA)
    // Comparamos el password enviado con el hash real de la DB
    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log("¿Bcrypt validó la contraseña?:", isValid);

    if (!isValid) {
      console.log("❌ ERROR: Contraseña incorrecta para:", cleanEmail);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // 4. GENERAR TOKEN
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