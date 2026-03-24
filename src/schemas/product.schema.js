const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  category: z.string().optional(),
  supplier_id: z.number().positive("El proveedor es obligatorio").optional(),
  unit: z.string().optional(),
  
  buy_cost: z.number().nonnegative("El costo no puede ser negativo").default(0),
  retail_price: z.number().nonnegative("El precio no puede ser negativo").default(0),
  mayor_price: z.number().nonnegative().default(0),
  
  stock: z.number().nonnegative("El stock inicial no puede ser negativo").default(0),
  min_stock: z.number().nonnegative().default(0),
  
  has_expiry: z.boolean().optional().default(false),
  expiry_date: z.string().nullable().optional(),
  
  is_kit: z.boolean().optional().default(false)
});

module.exports = { productSchema };