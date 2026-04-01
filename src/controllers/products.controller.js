// src/middlewares/error.middleware.js
// SEGURIDAD 3 FIX: en producción no se expone err.message al cliente
// (puede contener nombres de tablas, queries SQL, rutas internas, etc.)

const IS_PROD = process.env.NODE_ENV === "production";

module.exports = function errorMiddleware(err, req, res, next) {
  // Siempre logueamos el error completo en el servidor (Render logs)
  console.error(`[ERROR] ${req.method} ${req.path} —`, err.message);
  if (!IS_PROD) console.error(err.stack);

  const status = err.statusCode || err.status || 500;

  // En producción: mensaje genérico. En desarrollo: mensaje real para depurar.
  const message = IS_PROD
    ? getPublicMessage(status)
    : (err.message || "Error interno del servidor");

  res.status(status).json({
    ok: false,
    error: err.code || "INTERNAL_ERROR",
    message,
  });
};

function getPublicMessage(status) {
  const messages = {
    400: "Solicitud inválida.",
    401: "No autorizado.",
    403: "Sin permisos para esta acción.",
    404: "Recurso no encontrado.",
    429: "Demasiadas solicitudes. Intenta más tarde.",
    500: "Error interno del servidor.",
  };
  return messages[status] || "Ocurrió un error. Intenta de nuevo.";
}
