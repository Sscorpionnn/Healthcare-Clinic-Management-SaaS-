// Synthetic demo credentials — see packages/database/prisma/seed.ts. All
// accounts share DEMO_PASSWORD. Only the super admin email is fixed by the
// seed script; per-clinic staff emails include a random suffix, so CI
// captures the seed script's printed output and exports it as these env
// vars before running this suite (see .github/workflows/e2e.yml). Local
// runs without those vars fall back to values you can override on the CLI.
export const DEMO_PASSWORD = "Demo-Passw0rd!";

export const SUPER_ADMIN_EMAIL = "super.admin@example.test";
export const CLINIC_ADMIN_EMAIL = process.env.E2E_CLINIC_ADMIN_EMAIL ?? "";
export const RECEPTIONIST_EMAIL = process.env.E2E_RECEPTIONIST_EMAIL ?? "";
export const DOCTOR_EMAIL = process.env.E2E_DOCTOR_EMAIL ?? "";
