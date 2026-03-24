// Middleware para proteger el módulo de Marketing
exports.activeMarketingGuard = (req, res, next) => {
  const user = req.user; // Viene del token decodificado

  // Si el usuario es ADMIN o SUPER_ADMIN, suele tener permiso total
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN_BRAND') {
    return next();
  }

  // Si intenta acceder a funciones de marketing pero no es Marketing o está inactivo
  if (user.role === 'MARKETING' && user.is_active === true) {
    return next();
  }

  return res.status(403).json({ 
    error: "MODULO_INACCESIBLE", 
    message: "El módulo de Marketing no está activo para tu usuario o no tienes los permisos necesarios." 
  });
};