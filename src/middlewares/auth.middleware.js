// backend/src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const { MODULE_ACCESS } = require("../../constants/roles");

/**
 * 🛡️ VERIFICADOR DE TOKEN
 * Valida que el usuario esté logueado y extrae su información.
 */
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acceso denegado. No hay token." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("CRÍTICO: La variable JWT_SECRET no está definida en el entorno.");
    }

    const decoded = jwt.verify(token, secret);
    
    // 🛡️ NORMALIZACIÓN DE TENANT
    const finalTenantId = decoded.tenantId || decoded.tenant_id;

    if (!finalTenantId) {
      return res.status(403).json({ error: "Token inválido: Falta identificador de empresa (Tenant)" });
    }

    // 🚀 INYECCIÓN DE USUARIO
    // Guardamos los datos para que el siguiente middleware (checkModuleAccess) los use
    req.user = {
      ...decoded,
      tenantId: finalTenantId,
      tenant_id: finalTenantId
    }; 
    
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Su sesión ha expirado. Inicie sesión nuevamente." });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
};

/**
 * 🔐 GUARDIÁN DE MÓDULOS (RBAC)
 * Compara el rol del usuario con la "Fuente de Verdad" en constants/roles.js
 * Uso: checkModuleAccess('marketing'), checkModuleAccess('finance'), etc.
 */
exports.checkModuleAccess = (moduleName) => {
  return (req, res, next) => {
    const user = req.user; // Viene de verifyToken
    const allowedRoles = MODULE_ACCESS[moduleName];

    // 1. Verificar si el rol tiene permiso según roles.js
    if (!allowedRoles || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        ok: false,
        error: "ACCESO_DENEGADO", 
        message: `Tu rol (${user.role}) no tiene permiso para acceder al módulo: ${moduleName}` 
      });
    }

    // 2. Regla especial de seguridad para Marketing (Solo si está activo)
    if (user.role === 'MARKETING' && user.is_active === false) {
      return res.status(403).json({ 
        ok: false,
        error: "USUARIO_INACTIVO", 
        message: "Tu acceso al módulo de Marketing está pausado." 
      });
    }

    // 3. Si todo está bien, adelante
    next();
  };
};