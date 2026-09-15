import { z } from "zod";

const nameField = z.string().trim().min(1).max(100);

export const createPatientSchema = z
  .object({
    firstName: nameField,
    lastName: nameField,
    dateOfBirth: z.string().date(), // ISO date, e.g. "1990-05-21"
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/)
      .optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    address: z
      .object({
        line1: z.string().max(200).optional(),
        line2: z.string().max(200).optional(),
        city: z.string().max(100).optional(),
        postalCode: z.string().max(20).optional(),
        country: z.string().max(100).optional(),
      })
      .strict()
      .optional(),
    emergencyContact: z
      .object({
        name: z.string().max(100),
        phone: z.string().max(20),
        relationship: z.string().max(50).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

// `clinicId`, `id`, `userId`, `deletedAt` are intentionally absent — never
// client-writable (see docs/rbac.md, mass-assignment prevention).
export const updatePatientSchema = createPatientSchema.partial();
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
