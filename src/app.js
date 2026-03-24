const express = require("express");
const cors = require("cors");
const helmet = require("helmet"); 
const rateLimit = require("express-rate-limit"); 

const apiRoutes = require("./routes/index.routes");
const notFound = require("./middlewares/notFound.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

// --- 1. SEGURIDAD WEB (HELMET) ---
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// --- 2. LIMITADOR DE VELOCIDAD ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500, 
  message: {
    ok: false,
    error: "TOO_MANY_REQUESTS",
    message: "Demasiadas peticiones, intenta en un rato."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// --- 3. CONFIGURACIÓN DE CORS (ADAPTADO PARA DESPLIEGUE) ---
const allowedOrigins = [
  "http://127.0.0.1:5500", 
  "http://localhost:5500",
  "http://localhost:3000", // Por si pruebas con React/Vue después
  process.env.FRONTEND_URL // 👈 Aquí Render leerá tu URL de Netlify
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como Postman) o si están en la lista
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Acceso denegado por política de CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

// --- 4. RUTAS ---
app.use("/api", apiRoutes);

// --- 5. MANEJO DE ERRORES ---
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;