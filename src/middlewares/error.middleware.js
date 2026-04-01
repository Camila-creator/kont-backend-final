// src/middlewares/error.middleware.js
// SEGURIDAD: en producción no exponer err.message (puede revelar estructura interna)
const IS_PROD = process.env.NODE_ENV === "production";

module.exports = function errorMiddleware(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path} — ${err.message}`);
  if (!IS_PROD) console.error(err.stack);

  const status = err.statusCode || err.status || 500;

  const message = IS_PROD ? getPublicMessage(status) : (err.message || "Error interno");

  res.status(status).json({ ok: false, error: err.code || "INTERNAL_ERROR", message });
};

function getPublicMessage(status) {
  return {
    400: "Solicitud inválida.",
    401: "No autorizado.",
    403: "Sin permisos para esta acción.",
    404: "Recurso no encontrado.",
    429: "Demasiadas solicitudes. Intenta más tarde.",
    500: "Error interno del servidor.",
  }[status] || "Ocurrió un error. Intenta de nuevo.";
}