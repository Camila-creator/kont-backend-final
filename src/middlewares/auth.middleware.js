// backend/src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const { MODULE_ACCESS } = require("../../constants/roles");

/**
 * verifyToken — Valida el JWT y popula req.user
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
      throw new Error("CRÍTICO: JWT_SECRET no definido.");
    }

    const decoded = jwt.verify(token, secret);

    // Normalizar IDs — el token puede traer 'id' o 'userId' según cuándo fue generado
    const userId   = decoded.id || decoded.userId;
    const tenantId = decoded.tenantId || decoded.tenant_id;

    if (!tenantId) {
      return res.status(403).json({ error: "Token inválido: falta tenant." });
    }

    req.user = {
      ...decoded,
      id:         userId,
      userId:     userId,
      tenantId:   tenantId,
      tenant_id:  tenantId,
      role:       decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Sesión expirada. Inicia sesión de nuevo." });
    }
    return res.status(401).json({ error: "Token inválido." });
  }
};

/**
 * checkModuleAccess(moduleName) — RBAC basado en constants/roles.js
 * SUPER_ADMIN siempre pasa. Si el módulo no existe en el mapa, también pasa
 * (fail-open para no bloquear rutas que aún no están mapeadas).
 */
exports.checkModuleAccess = (moduleName) => {
  return (req, res, next) => {
    const { role } = req.user;

    // SUPER_ADMIN tiene acceso total — nunca lo bloqueamos
    if (role === "SUPER_ADMIN") return next();

    const allowedRoles = MODULE_ACCESS[moduleName];

    // Si el módulo no está en el mapa, lo dejamos pasar con advertencia
    // (así no bloqueamos rutas que olvidamos mapear)
    if (!allowedRoles) {
      console.warn(`[RBAC] Módulo no mapeado: "${moduleName}". Acceso permitido por defecto.`);
      return next();
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        ok: false,
        error: "ACCESO_DENEGADO",
        message: `Tu rol (${role}) no tiene permiso para: ${moduleName}`,
      });
    }

    // Regla especial: MARKETING inactivo no pasa
    if (role === "MARKETING" && req.user.is_active === false) {
      return res.status(403).json({
        ok: false,
        error: "USUARIO_INACTIVO",
        message: "Tu acceso al módulo de Marketing está pausado.",
      });
    }

    next();
  };
};
