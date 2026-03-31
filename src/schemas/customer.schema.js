const { z } = require('zod');

const customerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100),
  // Agregamos 'type' que es obligatorio en tu controlador
  type: z.enum(["RETAIL", "MAYORISTA"]).default("RETAIL"), 
  email: z.string().email("Formato de correo inválido").optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  // CAMBIAMOS 'rif' por 'doc' para que coincida con el frontend
  doc: z.string().min(5, "El documento es demasiado corto").optional().nullable(),
  location: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  terms: z.enum(["CONTADO", "CREDITO"]).default("CONTADO"),
  // Agregamos los campos numéricos y de texto extra
  wholesale_min: z.number().optional().default(6),
  notes: z.string().optional().nullable()
});

module.exports = { customerSchema };