const { z } = require('zod');

// 1. Definimos el esquema de los items por separado
const purchaseItemSchema = z.object({
  product_id: z.number().positive().nullable().optional(),
  supply_id: z.number().positive().nullable().optional(),
  qty: z.number().gt(0),
  unit_cost: z.number().nonnegative(),
  total: z.number().nonnegative().optional()
}).refine(data => data.product_id || data.supply_id, {
  message: "Cada item debe tener un product_id o un supply_id"
});

// 2. Esquema principal 
const purchaseCreateSchema = z.object({
  // Lo hacemos opcional porque usualmente el backend lo extrae del token/header, no del body del cliente
  tenant_id: z.number().optional(), 
  supplier_id: z.number().positive(),
  invoice_ref: z.string().max(50).optional().nullable().or(z.literal("")),
  status: z.enum(["BORRADOR", "CONFIRMADA", "ANULADA"]).default("BORRADOR"),
  condition: z.enum(["CONTADO", "CREDITO"]).default("CONTADO"),
  purchase_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  
  // --- CAMPOS DE DIVISAS Y PAGOS (¡Faltaban en tu Zod!) ---
  currency_code: z.string().optional().default("USD"),
  exchange_rate: z.number().positive().optional().default(1),
  total: z.number().nonnegative().optional(),
  payments: z.array(z.any()).optional(), // Permite recibir el array de pagos
  // ---------------------------------------------------------

  items: z.array(purchaseItemSchema).min(1, "La compra debe tener al menos un artículo")
});

module.exports = { purchaseCreateSchema };