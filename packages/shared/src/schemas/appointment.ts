import { z } from "zod";

export const createAppointmentSchema = z
  .object({
    patientId: z.string().uuid(),
    doctorId: z.string().uuid(),
    departmentId: z.string().uuid().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z.string().trim().max(280).optional(), // short, non-clinical only — see docs/privacy-model.md
  })
  .strict()
  .refine((data) => data.endsAt > data.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  })
  .refine((data) => data.startsAt.getTime() - Date.now() > -5 * 60 * 1000, {
    message: "startsAt cannot be in the past",
    path: ["startsAt"],
  });
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .strict()
  .refine((data) => data.endsAt > data.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });
export type RescheduleAppointmentInput = z.infer<
  typeof rescheduleAppointmentSchema
>;

export const cancelAppointmentSchema = z
  .object({
    cancelReason: z.string().trim().min(1).max(280),
  })
  .strict();
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
