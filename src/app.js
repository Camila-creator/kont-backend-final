const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const apiRoutes = require("./routes/index.routes");
const notFound = require("./middlewares/notFound.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

// Confianza en el proxy para Render/Vercel
app.set("trust proxy", 1);

// 1. SEGURIDAD BÁSICA
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// --- 2. CONFIGURACIÓN DE CORS (ESTILO EXPRESS 5) ---
const allowedOrigins = [
  "http://127.0.0.1:5500", 
  "http://localhost:5500",
  "http://localhost:3000"
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.trim());
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Acceso denegado por política de CORS"));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 // Vital para navegadores viejos y preflights
};

// Aplicar CORS a TODO de forma global antes que cualquier ruta
app.use(cors(corsOptions));

// ESTO REEMPLAZA AL app.options('*') QUE DABA ERROR
// Maneja el Preflight de forma manual y segura para Express 5
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 3. MIDDLEWARES DE PARSEO
app.use(express.json());

// 4. LIMITADOR DE VELOCIDAD
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    ok: false,
    error: "TOO_MANY_REQUESTS",
    message: "Demasiadas peticiones, intenta luego."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar a todas las rutas de la API
app.use("/api/", limiter);

// 5. RUTAS
app.use("/api", apiRoutes);

// 6. MANEJO DE ERRORES (AL FINAL)
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;