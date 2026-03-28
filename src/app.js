const express = require("express");
const cors = require("cors");
const helmet = require("helmet"); 
const rateLimit = require("express-rate-limit"); 

const apiRoutes = require("./routes/index.routes");
const notFound = require("./middlewares/notFound.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

app.set("trust proxy", 1);

// --- 1. SEGURIDAD WEB (HELMET) ---
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// --- 2. CONFIGURACIÓN DE CORS ---
const allowedOrigins = [
  "http://127.0.0.1:5500", 
  "http://localhost:5500",
  "http://localhost:3000"
];

// Protección para que el servidor no falle si la variable está vacía
if (process.env.FRONTEND_URL) {
  const cleanUrl = process.env.FRONTEND_URL.trim();
  allowedOrigins.push(cleanUrl);
}

app.use(cors({
  origin: function (origin, callback) {
    // Permitir si no hay origen (Postman) o si está en la lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS bloqueado para: ${origin}`);
      callback(new Error("Acceso denegado por política de CORS"));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Preflight para evitar el error de login
app.options('*', cors());

// --- 3. LIMITADOR DE VELOCIDAD ---
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
app.use(express.json());

// --- 4. RUTAS ---
app.use("/api", apiRoutes);

// --- 5. MANEJO DE ERRORES ---
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;