module.exports = function notFound(req, res, next) {
  res.status(404).json({
    ok: false,
    error: "NOT_FOUND",
    message: `No existe: ${req.method} ${req.originalUrl}`,
  });
};
