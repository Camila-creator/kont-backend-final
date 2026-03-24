const { z } = require('zod');

const customerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100),
  email: z.string().email("Formato de correo inválido").optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().optional().nullable(),
  rif: z.string().min(5, "El RIF/Cédula es demasiado corto").optional().nullable(),
  terms: z.enum(["CONTADO", "CREDITO"]).default("CONTADO")
});

module.exports = { customerSchema };