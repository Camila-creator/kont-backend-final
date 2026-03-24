// Este archivo es el que hace que Zod funcione como middleware
exports.validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body); // Si los datos están mal, salta al catch
    next(); // Si están bien, sigue al controlador
  } catch (err) {
    return res.status(400).json({ 
      ok: false, 
      error: "VALIDATION_ERROR", 
      details: err.errors 
    });
  }
};