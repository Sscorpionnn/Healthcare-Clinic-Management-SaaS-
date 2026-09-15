export const ROLES = [
  "SUPER_ADMIN",
  "CLINIC_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "BILLING_MANAGER",
  "PATIENT",
] as const;

export type Role = (typeof ROLES)[number];

export const CLINIC_STAFF_ROLES: Role[] = [
  "CLINIC_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "BILLING_MANAGER",
];

export const CLINICAL_ROLES: Role[] = ["DOCTOR", "NURSE"];
