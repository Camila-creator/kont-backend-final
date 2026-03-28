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

/// --- 2. CONFIGURACIÓN DE CORS DINÁMICO ---
app.use(cors({
  origin: function (origin, callback) {
    // Definimos qué dominios permitimos
    const allowed = [
      'https://kont-frontend-final.vercel.app',
      'http://localhost:5500',
      'http://127.0.0.1:5500'
    ];
    
    // Si no hay origen (Postman) o está en la lista, permitimos
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      console.error("CORS bloqueado para:", origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Manejo manual de Preflight (Esto es lo que te está bloqueando el Login)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origin.includes('vercel.app')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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