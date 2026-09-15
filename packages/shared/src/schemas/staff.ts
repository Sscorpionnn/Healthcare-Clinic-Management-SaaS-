import { z } from "zod";
import { emailSchema } from "./auth";

const STAFF_ROLES = [
  "CLINIC_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "BILLING_MANAGER",
] as const;

export const inviteStaffSchema = z
  .object({
    email: emailSchema,
    role: z.enum(STAFF_ROLES),
    departmentId: z.string().uuid().optional(),
    // Only present when role === "DOCTOR"; validated in the service layer
    // against role, not embedded here as a discriminated union, to keep the
    // invite form usable for every role with one shared schema.
    specialty: z.string().trim().max(100).optional(),
    licenseNumber: z.string().trim().max(100).optional(),
  })
  .strict();
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const updateStaffRoleSchema = z
  .object({
    role: z.enum(STAFF_ROLES),
  })
  .strict();
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;

export const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
  })
  .strict();
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const availabilitySlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional(),
  })
  .strict()
  .refine((data) => data.endMinute > data.startMinute, {
    message: "endMinute must be after startMinute",
    path: ["endMinute"],
  });
export type AvailabilitySlotInput = z.infer<typeof availabilitySlotSchema>;
