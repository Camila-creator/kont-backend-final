const { z } = require('zod');

const customerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100),
  type: z.enum(["RETAIL", "MAYORISTA"]).default("RETAIL"), // ¡Faltaba este!
  email: z.string().email("Formato de correo inválido").optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  doc: z.string().min(5, "El documento es demasiado corto").optional().nullable(), // Cambiado rif -> doc
  location: z.string().optional().nullable(), // ¡Faltaba este!
  address: z.string().optional().nullable(),
  terms: z.enum(["CONTADO", "CREDITO"]).default("CONTADO"),
  wholesale_min: z.number().optional().default(0), // ¡Faltaba este!
  notes: z.string().optional().nullable() // ¡Faltaba este!
});

module.exports = { customerSchema };