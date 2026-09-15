/**
 * Mass assignment — docs/test-strategy.md, docs/rbac.md.
 * Requires a live Postgres + Redis stack; not executed in the authoring
 * environment. Typechecked via `pnpm --filter api run typecheck:test`.
 *
 * The `.strict()` Zod schemas in `@clinic/shared` should reject unknown
 * fields at the DTO layer; these tests prove that end-to-end through the
 * real HTTP pipeline rather than trusting the schema definition alone.
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import {
  csrfTokenFromCookies,
  seedClinicFixture,
  type ClinicFixture,
} from "../fixtures/clinic-fixture";

describe("Mass assignment protections", () => {
  let app: INestApplication;
  let clinic: ClinicFixture;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    clinic = await seedClinicFixture(app, "mass-assign");
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("rejects `role`/`clinicId`/`id` smuggled into a patient creation body", async () => {
    const cookies = clinic.sessions.RECEPTIONIST!.cookies;
    const res = await request(app.getHttpServer())
      .post("/api/v1/patients")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .send({
        firstName: "Test",
        lastName: "Patient",
        dateOfBirth: "1990-01-01",
        // attacker-supplied fields that must never be honored:
        role: "CLINIC_ADMIN",
        clinicId: "some-other-clinic-id",
        id: "attacker-chosen-id",
      })
      .expect(400);
    expect(res.body.title ?? res.body.detail ?? "").toBeTruthy();
  });

  it("rejects a status field smuggled into an appointment reschedule body (state machine only, never a raw PATCH)", async () => {
    const cookies = clinic.sessions.CLINIC_ADMIN!.cookies;
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${clinic.appointmentId}/reschedule`)
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .send({
        startsAt: new Date(Date.now() + 3600_000).toISOString(),
        endsAt: new Date(Date.now() + 5400_000).toISOString(),
        status: "COMPLETED", // not a field on rescheduleAppointmentSchema
      })
      .expect(400);
    expect(res.status).toBe(400);
  });

  it("rejects an attempt to set staff role via the invite endpoint outside the enum (privilege escalation attempt)", async () => {
    const cookies = clinic.sessions.CLINIC_ADMIN!.cookies;
    await request(app.getHttpServer())
      .post("/api/v1/staff/invite")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .send({ email: "escalation-attempt@example.test", role: "SUPER_ADMIN" })
      .expect(400);
  });

  it("a CLINIC_ADMIN cannot self-promote via the role-update endpoint", async () => {
    const cookies = clinic.sessions.CLINIC_ADMIN!.cookies;
    await request(app.getHttpServer())
      .patch(`/api/v1/staff/${clinic.sessions.CLINIC_ADMIN!.membershipId}/role`)
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .send({ role: "CLINIC_ADMIN" })
      .expect(403);
  });

  it("rejects an unknown field on document upload-intent (e.g. a client-chosen storageKey)", async () => {
    const cookies = clinic.sessions.RECEPTIONIST!.cookies;
    await request(app.getHttpServer())
      .post("/api/v1/documents/upload-intent")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .send({
        ownerPatientId: clinic.otherPatientProfileId,
        category: "INTAKE",
        filename: "test.pdf",
        declaredMimeType: "application/pdf",
        sizeBytes: 1000,
        storageKey: "attacker/chosen/path.pdf",
      })
      .expect(400);
  });
});
