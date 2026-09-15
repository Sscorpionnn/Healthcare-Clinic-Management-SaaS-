import { z } from "zod";

// OWASP ASVS-aligned: length over composition rules, but a floor on
// character variety to block trivially weak passwords; real strength
// comes from length + a breached-password check (out of scope for this
// repo, wired as a TODO hook in the auth service).
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a digit");

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128), // no complexity check on login, only on set/reset
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
  })
  .strict();
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const requestPasswordResetSchema = z
  .object({
    email: emailSchema,
  })
  .strict();
export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
  })
  .strict();
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const selectClinicSchema = z
  .object({
    membershipId: z.string().uuid(),
  })
  .strict();
export type SelectClinicInput = z.infer<typeof selectClinicSchema>;

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1).optional(), // usually read from httpOnly cookie instead
  })
  .strict();
