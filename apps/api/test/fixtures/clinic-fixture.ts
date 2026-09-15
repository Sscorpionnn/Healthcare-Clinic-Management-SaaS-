/**
 * Fast, self-contained test-fixture builder for e2e/security specs.
 *
 * Writes directly via `@clinic/database`'s BYPASSRLS platform client (the
 * same pattern `packages/database/prisma/seed.ts` uses) rather than the
 * full faker-seeded demo dataset — this needs to be quick and
 * deterministic per test run, not realistic/large. Ordinary tenant-scoped
 * reads still go through `withTenantContext`, since RLS is enforced even
 * for these rows once written.
 *
 * All identities use `example.test` emails and a fixed, non-production
 * password — synthetic only, matching docs/privacy-model.md.
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { hashPassword, type Role } from "@clinic/shared";
import { encryptField, getPlatformClient } from "@clinic/database";

export const FIXTURE_PASSWORD = "Fixture-Passw0rd!";

// SUPER_ADMIN is platform-level (User.isSuperAdmin), not a per-clinic
// Membership row — see packages/database/prisma/schema.prisma. The other
// 6 Role values each get one Membership in the fixture clinic.
const CLINIC_ROLES: Role[] = [
  "CLINIC_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "BILLING_MANAGER",
  "PATIENT",
];

export interface RoleSession {
  userId: string;
  membershipId: string;
  email: string;
  cookies: string[];
}

export interface ClinicFixture {
  clinicId: string;
  slug: string;
  sessions: Record<Role, RoleSession | undefined>;
  doctorProfileId: string;
  /** The fixture's PATIENT-role session's own linked profile. */
  patientProfileId: string;
  /** A second, different patient in the same clinic — owns the resource chain (appointment/record/document/invoice) and has no portal login. */
  otherPatientProfileId: string;
  appointmentId: string;
  medicalRecordId: string;
  treatmentNoteId: string;
  documentId: string;
  invoiceId: string;
}

async function loginAndCaptureCookies(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string[]> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);
  const cookies = response.get("Set-Cookie");
  if (!cookies || cookies.length === 0) {
    throw new Error(`login for ${email} did not return session cookies`);
  }
  return cookies;
}

/** Creates one clinic with a member in every clinic-scoped role, plus one full resource chain (patient -> appointment -> medical record -> treatment note -> document -> invoice). */
export async function seedClinicFixture(
  app: INestApplication,
  slug: string,
): Promise<ClinicFixture> {
  const platform = getPlatformClient();
  const passwordHash = await hashPassword(FIXTURE_PASSWORD);

  const clinic = await platform.clinic.create({
    data: {
      name: `Fixture Clinic ${slug}`,
      slug: `${slug}-${randomUUID().slice(0, 8)}`,
      timezone: "UTC",
    },
  });

  const sessions: Partial<Record<Role, RoleSession>> = {};
  let doctorProfileId = "";
  let patientProfileId = "";

  for (const role of CLINIC_ROLES) {
    const email = `${slug}.${role.toLowerCase()}.${randomUUID().slice(0, 8)}@example.test`;
    const user = await platform.user.create({
      data: { email, passwordHash, isActive: true },
    });
    const membership = await platform.membership.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
        role,
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    if (role === "DOCTOR") {
      const doctor = await platform.doctorProfile.create({
        data: {
          clinicId: clinic.id,
          membershipId: membership.id,
          specialty: "General",
          licenseNumber: encryptField("FIXTURE-LIC"),
        },
      });
      doctorProfileId = doctor.id;
    }

    if (role === "PATIENT") {
      const patient = await platform.patientProfile.create({
        data: {
          clinicId: clinic.id,
          userId: user.id,
          firstName: encryptField("Fixture"),
          lastName: encryptField("Patient"),
          dateOfBirth: encryptField("1990-01-01"),
        },
      });
      patientProfileId = patient.id;
    }

    const cookies = await loginAndCaptureCookies(app, email, FIXTURE_PASSWORD);
    sessions[role] = {
      userId: user.id,
      membershipId: membership.id,
      email,
      cookies,
    };
  }

  // A second, non-portal patient owns the resource chain so PATIENT-role
  // policy checks (which require patientProfile.userId === the caller) are
  // exercised against a genuinely different patient than the fixture's own
  // PATIENT session where relevant.
  const chainPatient = await platform.patientProfile.create({
    data: {
      clinicId: clinic.id,
      firstName: encryptField("Chain"),
      lastName: encryptField("Patient"),
      dateOfBirth: encryptField("1985-06-15"),
    },
  });

  const appointment = await platform.appointment.create({
    data: {
      clinicId: clinic.id,
      patientId: chainPatient.id,
      doctorId: doctorProfileId,
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 90 * 60 * 1000),
      status: "CONFIRMED",
      reason: "Fixture visit",
    },
  });

  const medicalRecord = await platform.medicalRecord.create({
    data: {
      clinicId: clinic.id,
      patientId: chainPatient.id,
      doctorId: doctorProfileId,
      appointmentId: appointment.id,
      visitDate: new Date(),
      chiefComplaint: encryptField("Fixture complaint"),
      status: "DRAFT",
    },
  });

  const treatmentNote = await platform.treatmentNote.create({
    data: {
      clinicId: clinic.id,
      medicalRecordId: medicalRecord.id,
      authorMembershipId: sessions.DOCTOR!.membershipId,
      noteType: "progress",
      content: encryptField("Fixture note content"),
    },
  });

  const document = await platform.document.create({
    data: {
      clinicId: clinic.id,
      ownerPatientId: chainPatient.id,
      medicalRecordId: medicalRecord.id,
      uploadedByMembershipId: sessions.DOCTOR!.membershipId,
      category: "CLINICAL",
      originalFilename: "fixture.pdf",
      declaredMimeType: "application/pdf",
      sizeBytes: 1024,
      storageKey: `fixture/${clinic.id}/${randomUUID()}.pdf`,
      status: "AVAILABLE",
    },
  });

  const invoice = await platform.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: chainPatient.id,
      appointmentId: appointment.id,
      status: "ISSUED",
      totalAmount: 100,
      issuedAt: new Date(),
      lineItems: {
        create: [
          {
            description: "Fixture line item",
            quantity: 1,
            unitAmount: 100,
            amount: 100,
          },
        ],
      },
    },
  });

  return {
    clinicId: clinic.id,
    slug,
    sessions: sessions as Record<Role, RoleSession | undefined>,
    doctorProfileId,
    patientProfileId,
    otherPatientProfileId: chainPatient.id,
    appointmentId: appointment.id,
    medicalRecordId: medicalRecord.id,
    treatmentNoteId: treatmentNote.id,
    documentId: document.id,
    invoiceId: invoice.id,
  };
}

export function csrfTokenFromCookies(cookies: string[]): string {
  const match = cookies.map((c) => /csrf_token=([^;]+)/.exec(c)).find(Boolean);
  if (!match) throw new Error("csrf_token cookie not found in session");
  return decodeURIComponent(match[1]!);
}
