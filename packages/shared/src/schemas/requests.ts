import { z } from "zod";

export const createDataExportRequestSchema = z
  .object({
    subjectPatientId: z.string().uuid().optional(), // omitted => clinic-wide export (CLINIC_ADMIN only)
  })
  .strict();
export type CreateDataExportRequestInput = z.infer<
  typeof createDataExportRequestSchema
>;

export const createDeletionRequestSchema = z
  .object({
    subjectType: z.enum(["PATIENT", "CLINIC"]),
    subjectPatientId: z.string().uuid().optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
export type CreateDeletionRequestInput = z.infer<
  typeof createDeletionRequestSchema
>;

export const reviewDeletionRequestSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    retentionHoldReason: z.string().trim().max(500).optional(),
  })
  .strict();
export type ReviewDeletionRequestInput = z.infer<
  typeof reviewDeletionRequestSchema
>;
