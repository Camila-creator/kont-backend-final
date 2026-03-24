module.exports = function errorMiddleware(err, req, res, next) {
  console.error("❌ Error:", err);

  const status = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Algo se rompió por dentro 😭";

  res.status(status).json({ ok: false, error: code, message });
};
