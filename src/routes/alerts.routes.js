const express = require("express");
const router = express.Router();

// Importamos el controlador de alertas
const ctrl = require("../controllers/alert.controller");

// Traemos al guardia de seguridad (Middleware)
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");

/**
 * RUTAS DE ALERTAS Y NOTIFICACIONES
 * Todas protegidas por verifyToken
 */

// 1. Obtener todas las alertas del tenant (activas y pendientes)
router.get("/", verifyToken, checkModuleAccess("alerts"), ctrl.list);

// 2. Obtener el conteo de alertas no leídas (útil para el badge de la campana)
router.get("/unread-count", verifyToken, checkModuleAccess("alerts"), ctrl.getUnreadCount);

// 3. Marcar una alerta como leída/resuelta
// Se usa PUT o PATCH porque estamos actualizando el estado de la alerta
router.put("/:id/resolve", verifyToken, checkModuleAccess("alerts"), ctrl.resolve);

// 4. Marcar todas las alertas como leídas (Botón "Limpiar todo")
router.post("/mark-all-read", verifyToken, checkModuleAccess("alerts"), ctrl.markAllRead);

// 5. Eliminar una alerta específica si es necesario
router.delete("/:id", verifyToken, checkModuleAccess("alerts"), ctrl.remove);

module.exports = router;