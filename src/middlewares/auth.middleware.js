// backend/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acceso denegado. No hay token." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Si JWT_SECRET no existe, el sistema debe dar error, no inventarse una clave
const secret = process.env.JWT_SECRET;

if (!secret) {
    throw new Error("CRÍTICO: La variable JWT_SECRET no está definida en el entorno.");
}
    const decoded = jwt.verify(token, secret);
    
    // 🛡️ NORMALIZACIÓN: Buscamos el ID en cualquier formato que venga
    const finalTenantId = decoded.tenantId || decoded.tenant_id;

    if (!finalTenantId) {
      return res.status(403).json({ error: "Token inválido: Falta identificador de empresa (Tenant)" });
    }

    // 🚀 LA MAGIA: Inyectamos ambos formatos en req.user
    // Así, si un controlador busca .tenantId o .tenant_id, AMBOS funcionarán.
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