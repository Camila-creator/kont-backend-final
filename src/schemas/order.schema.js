const { z } = require('zod');

const orderCreateSchema = z.object({
  customer_id: z.number({ required_error: "El ID del cliente es obligatorio" }),
  status: z.string().optional(),
  terms: z.string().optional(),
  price_mode: z.string().optional(),
  wholesale_threshold: z.number().optional(),
  notes: z.string().optional().nullable(),
  order_date: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.number(),
    qty: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
    unit_price: z.number().min(0, "El precio no puede ser negativo")
  })).min(1, "El pedido debe tener al menos un producto")
});

const orderUpdateSchema = orderCreateSchema.partial(); // .partial() hace que todo sea opcional
module.exports = { orderCreateSchema, orderUpdateSchema };

