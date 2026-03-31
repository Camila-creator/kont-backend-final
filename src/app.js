// backend/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const apiRoutes = require("./routes/index.routes");
const notFound = require("./middlewares/notFound.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

// Confianza en proxy para Render/Railway
app.set("trust proxy", 1);

// 1. SEGURIDAD BÁSICA
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// 2. CORS — un solo lugar, sin duplicados
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Siempre incluimos localhost para desarrollo
const DEV_ORIGINS = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
];

app.use(cors({
  origin: function (origin, callback) {
    // Sin origen = Postman/curl, permitimos en desarrollo
    if (!origin) return callback(null, true);

    const allowed = [...ALLOWED_ORIGINS, ...DEV_ORIGINS];
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("CORS bloqueado para:", origin);
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// 3. PARSEO JSON
app.use(express.json());

// 4. RATE LIMITING
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    ok: false,
    error: "TOO_MANY_REQUESTS",
    message: "Demasiadas peticiones, intenta más tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// 5. RUTAS
app.use("/api", apiRoutes);

// 6. MANEJO DE ERRORES
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
