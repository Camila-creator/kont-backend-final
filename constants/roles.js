// constants/roles.js — Fuente única de verdad para roles y permisos de Kont

const ROLES = {
  SUPER_ADMIN:  "SUPER_ADMIN",
  ADMIN:        "ADMIN",
  COORDINATOR:  "COORDINATOR",
  SELLER:       "SELLER",
  FINANCE:      "FINANCE",
  MARKETING:    "MARKETING",
  WAREHOUSE:    "WAREHOUSE",
};

// Grupos reutilizables
const ALL           = Object.values(ROLES);
const ADMIN_UP      = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const MGMT          = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR];
const OPS           = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR, ROLES.SELLER, ROLES.WAREHOUSE];
const FINANCE_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR, ROLES.FINANCE];
const MKT_ROLES     = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COORDINATOR, ROLES.MARKETING];
const SAAS_ONLY     = [ROLES.SUPER_ADMIN];

const MODULE_ACCESS = {
  // ── Dashboards ──────────────────────────────────────────
  dashboard_main:         ALL,
  finance_dashboard:      FINANCE_ROLES,
  superadmin_dashboard:   SAAS_ONLY,
  intelligence:           MGMT,

  // ── Inventario ──────────────────────────────────────────
  products:               OPS,
  supplies:               OPS,
  supply_categories:      OPS,
  recipes:                OPS,
  productions:            OPS,
  serials:                OPS,
  received_phones:        OPS,

  // ── Operaciones ─────────────────────────────────────────
  orders:                 OPS,
  purchases:              OPS,
  suppliers:              OPS,
  customers:              OPS,
  invoices:               OPS,

  // ── Finanzas ────────────────────────────────────────────
  finance:                FINANCE_ROLES,
  finance_accounts:       FINANCE_ROLES,
  finance_banks:          FINANCE_ROLES,
  finance_routing:        FINANCE_ROLES,
  caja:                   FINANCE_ROLES,
  expenses:               FINANCE_ROLES,
  exchange:               FINANCE_ROLES,
  cxc:                    FINANCE_ROLES,
  customer_payments:      FINANCE_ROLES,
  supplier_payments:      FINANCE_ROLES,
  payroll:                FINANCE_ROLES,
  reconciliation:         FINANCE_ROLES,

  // ── Marketing ───────────────────────────────────────────
  marketing:              MKT_ROLES,
  brand_assets:           MKT_ROLES,
  buyer_personas:         MKT_ROLES,
  mkt_calendar:           MKT_ROLES,
  mkt_ads:                MKT_ROLES,
  mkt_offline:            MKT_ROLES,
  mkt_influencers:        MKT_ROLES,
  mkt_tasks:              MKT_ROLES,
  mkt_results:            MKT_ROLES,

  // ── Gestión ─────────────────────────────────────────────
  users:                  ADMIN_UP,
  audit:                  MGMT,
  alerts:                 ALL,
  support_tickets:        ALL,

  // ── Super Admin SaaS ────────────────────────────────────
  tenants:                SAAS_ONLY,
  superadmin_reportes:    SAAS_ONLY,
  superadmin_soporte:     SAAS_ONLY,
  superadmin_usuarios_globales: SAAS_ONLY,
};

module.exports = { ROLES, MODULE_ACCESS };
