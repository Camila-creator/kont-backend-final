// constants/roles.js

const ROLES = {
  SUPER_ADMIN:  "SUPER_ADMIN",   // Tú — acceso total al panel SaaS
  ADMIN:        "ADMIN",         // Dueño/admin de una empresa tenant
  COORDINATOR:  "COORDINATOR",   // Coordinador — ve dashboards de su equipo
  SELLER:       "SELLER",        // Vendedor — pedidos, clientes
  FINANCE:      "FINANCE",       // Finanzas — gastos, CxC, CxP, bancos
  MARKETING:    "MARKETING",     // Marketing — módulo completo de mkt
  WAREHOUSE:    "WAREHOUSE",     // Almacén — inventario, compras
};

// Qué roles pueden acceder a cada módulo
// Úsalo en tus middlewares para proteger rutas
const MODULE_ACCESS = {
  finance:    [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR, ROLES.FINANCE],
  marketing:  [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR, ROLES.MARKETING],
  inventory:  [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR, ROLES.WAREHOUSE],
  orders:     [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR, ROLES.SELLER, ROLES.FINANCE],
  superadmin: [ROLES.SUPER_ADMIN],
  users:      [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  audit:      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR],
};

module.exports = { ROLES, MODULE_ACCESS };
