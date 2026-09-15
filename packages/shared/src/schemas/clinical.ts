import { z } from "zod";

export const createMedicalRecordSchema = z
  .object({
    patientId: z.string().uuid(),
    appointmentId: z.string().uuid().optional(),
    visitDate: z.coerce.date(),
    chiefComplaint: z.string().trim().max(2000).optional(),
    diagnosisNotes: z.string().trim().max(4000).optional(),
  })
  .strict();
export type CreateMedicalRecordInput = z.infer<
  typeof createMedicalRecordSchema
>;

export const finalizeMedicalRecordSchema = z
  .object({
    diagnosisNotes: z.string().trim().min(1).max(4000),
  })
  .strict();
export type FinalizeMedicalRecordInput = z.infer<
  typeof finalizeMedicalRecordSchema
>;

export const createTreatmentNoteSchema = z
  .object({
    medicalRecordId: z.string().uuid(),
    noteType: z.string().trim().min(1).max(50),
    content: z.string().trim().min(1).max(8000),
  })
  .strict();
export type CreateTreatmentNoteInput = z.infer<
  typeof createTreatmentNoteSchema
>;
