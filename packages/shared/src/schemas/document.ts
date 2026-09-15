import { z } from "zod";

export const DOCUMENT_CATEGORIES = [
  "CLINICAL",
  "BILLING",
  "INTAKE",
  "IDENTITY",
] as const;

// Allowlist is intentionally narrow — see docs/document-security.md.
// SVG is excluded even though it's an "image" because it can carry script
// content; HTML/executable/script extensions are never allowed.
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const createUploadIntentSchema = z
  .object({
    ownerPatientId: z.string().uuid(),
    medicalRecordId: z.string().uuid().optional(),
    category: z.enum(DOCUMENT_CATEGORIES),
    filename: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(/^[^/\\]+$/, "Filename must not contain path separators"),
    declaredMimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
    sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
  })
  .strict();
export type CreateUploadIntentInput = z.infer<typeof createUploadIntentSchema>;
