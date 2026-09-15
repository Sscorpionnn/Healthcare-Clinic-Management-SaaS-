/**
 * Mandatory tenant-isolation / IDOR suite — see docs/test-strategy.md.
 *
 * Requires a live Postgres + Redis stack (docker-compose.test.yml) with
 * migrations, RLS policies (prisma/rls.sql), and DB roles
 * (prisma/roles.sql) applied. Written and typechecked but NOT executed in
 * the environment this repo was authored in — no Docker daemon or
 * reachable Postgres/Redis was available there (verified via `docker -v`,
 * `docker ps`, and a direct TCP check against the ports in `.env.example`;
 * all failed). Run via `pnpm --filter api run test:e2e` against the
 * compose stack in CI (see .github/workflows/ci.yml).
 *
 * Pattern: seed two clinics via seedClinicFixture; as every clinic-A role,
 * attempt every representative entity-by-id read/mutation against
 * clinic B's resources; assert 404 (never 403, and never any clinic-B
 * field value in the body) per docs/multi-tenancy.md, IDOR prevention.
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import {
  csrfTokenFromCookies,
  seedClinicFixture,
  type ClinicFixture,
} from "./fixtures/clinic-fixture";

describe("Tenant isolation / IDOR (requires live Postgres+Redis)", () => {
  let app: INestApplication;
  let clinicA: ClinicFixture;
  let clinicB: ClinicFixture;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    clinicA = await seedClinicFixture(app, "tenant-a");
    clinicB = await seedClinicFixture(app, "tenant-b");
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 (not 403) when clinic A's admin reads clinic B's patient, with no leaked fields", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/patients/${clinicB.patientProfileId}`)
      .set("Cookie", clinicA.sessions.CLINIC_ADMIN!.cookies)
      .expect(404);
    expect(JSON.stringify(res.body)).not.toContain(clinicB.patientProfileId);
  });

  it("returns 404 when clinic A's admin reads clinic B's appointment", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${clinicB.appointmentId}`)
      .set("Cookie", clinicA.sessions.CLINIC_ADMIN!.cookies)
      .expect(404);
  });

  it("returns 404 when clinic A's doctor reads clinic B's medical record", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/medical-records/${clinicB.medicalRecordId}`)
      .set("Cookie", clinicA.sessions.DOCTOR!.cookies)
      .expect(404);
  });

  it("returns 404 when clinic A's doctor lists notes on clinic B's medical record", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/medical-records/${clinicB.medicalRecordId}/notes`)
      .set("Cookie", clinicA.sessions.DOCTOR!.cookies)
      .expect(404);
  });

  it("returns 404 when clinic A requests a download URL for clinic B's document", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/documents/${clinicB.documentId}/download-url`)
      .set("Cookie", clinicA.sessions.CLINIC_ADMIN!.cookies)
      .expect(404);
  });

  it("returns 404 when clinic A's billing manager reads clinic B's invoice", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/invoices/${clinicB.invoiceId}`)
      .set("Cookie", clinicA.sessions.BILLING_MANAGER!.cookies)
      .expect(404);
  });

  it("rejects a cross-tenant mutation the same way (cancel another clinic's appointment)", async () => {
    const cookies = clinicA.sessions.CLINIC_ADMIN!.cookies;
    await request(app.getHttpServer())
      .post(`/api/v1/appointments/${clinicB.appointmentId}/cancel`)
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .send({ cancelReason: "test" })
      .expect(404);
  });

  it("rejects clinic A's receptionist reading clinic B's staff list results (cross-tenant listing never mixes rows)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/staff`)
      .set("Cookie", clinicA.sessions.CLINIC_ADMIN!.cookies)
      .expect(200);
    const emails = (res.body.data as Array<{ user?: { email?: string } }>).map(
      (m) => m.user?.email,
    );
    for (const session of Object.values(clinicB.sessions)) {
      if (session) expect(emails).not.toContain(session.email);
    }
  });

  describe("cross-role access within the same clinic", () => {
    it("RECEPTIONIST cannot read a medical record (403/404, never the clinical content)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/medical-records/${clinicA.medicalRecordId}`)
        .set("Cookie", clinicA.sessions.RECEPTIONIST!.cookies);
      expect([403, 404]).toContain(res.status);
    });

    it("BILLING_MANAGER cannot read treatment notes", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/medical-records/${clinicA.medicalRecordId}/notes`)
        .set("Cookie", clinicA.sessions.BILLING_MANAGER!.cookies);
      expect([403, 404]).toContain(res.status);
    });

    it("a PATIENT cannot read another patient's profile in the same clinic", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${clinicA.otherPatientProfileId}`)
        .set("Cookie", clinicA.sessions.PATIENT!.cookies);
      expect([403, 404]).toContain(res.status);
    });
  });
});
