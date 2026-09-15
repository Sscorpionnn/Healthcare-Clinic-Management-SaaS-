import { z } from "zod";
import { emailSchema } from "./auth";

export const createClinicSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(63)
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Slug must be lowercase, alphanumeric, hyphen-separated",
      ),
    timezone: z.string().trim().min(1).max(64).default("UTC"),
    adminEmail: emailSchema,
  })
  .strict();
export type CreateClinicInput = z.infer<typeof createClinicSchema>;

export const updateClinicSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;

export const suspendClinicSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type SuspendClinicInput = z.infer<typeof suspendClinicSchema>;
