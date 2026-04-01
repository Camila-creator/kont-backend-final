const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken"); // Necesario para leer el ID del usuario

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

// 2. CORS
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

const DEV_ORIGINS = [
    "https://kont-frontend-final.vercel.app",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
];

app.use(cors({
    origin: function (origin, callback) {
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

// 4. RATE LIMITING INTELIGENTE (Por Usuario o IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // Límite de peticiones
    keyGenerator: (req) => {
        // Intentamos obtener el ID del usuario desde el token JWT
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            try {
                const token = authHeader.split(" ")[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                return `user_${decoded.id}`; // Si está logueado, el límite es por su ID
            } catch (err) {
                // Si el token es inválido, caerá al default (IP)
            }
        }
        return req.ip; // Si no hay token (login, registro), el límite es por IP
    },
    message: {
        ok: false,
        error: "TOO_MANY_REQUESTS",
        message: "Has excedido el límite de peticiones. Intenta de nuevo en 15 minutos.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicamos el limitador a todas las rutas de la API
app.use("/api/", limiter);

// 5. RUTAS
app.use("/api", apiRoutes);

// 6. MANEJO DE ERRORES
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;