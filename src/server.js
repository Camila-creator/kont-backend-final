const app = require("./app");
// Render asigna un puerto automáticamente en la variable PORT
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`
  🚀 Kont admin - SISTEMA ACTIVO
  🌍 Entorno: ${process.env.NODE_ENV || 'development'}
  🔌 Puerto: ${PORT}
  `);
});

module.exports = app;