/**
 * CSRF — docs/api-contract.md, docs/threat-model.md T8.
 * Requires a live Postgres + Redis stack; not executed in the authoring
 * environment. Typechecked via `pnpm --filter api run typecheck:test`.
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

describe("CSRF protections", () => {
  let app: INestApplication;
  let clinic: ClinicFixture;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    clinic = await seedClinicFixture(app, "csrf");
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("rejects a mutating request with a valid session but no X-CSRF-Token header", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/appointments/${clinic.appointmentId}/cancel`)
      .set("Cookie", clinic.sessions.CLINIC_ADMIN!.cookies)
      .send({ cancelReason: "no csrf header" })
      .expect(403);
  });

  it("rejects a mutating request whose X-CSRF-Token doesn't match the csrf_token cookie", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/appointments/${clinic.appointmentId}/cancel`)
      .set("Cookie", clinic.sessions.CLINIC_ADMIN!.cookies)
      .set("X-CSRF-Token", "attacker-guessed-value")
      .send({ cancelReason: "mismatched csrf" })
      .expect(403);
  });

  it("rejects a mutating request from a disallowed Origin even with a correct CSRF token", async () => {
    const cookies = clinic.sessions.CLINIC_ADMIN!.cookies;
    await request(app.getHttpServer())
      .post(`/api/v1/appointments/${clinic.appointmentId}/cancel`)
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .set("Origin", "https://attacker.example")
      .send({ cancelReason: "wrong origin" })
      .expect(403);
  });

  it("allows a mutating request with a matching token and an allowed Origin", async () => {
    const cookies = clinic.sessions.CLINIC_ADMIN!.cookies;
    await request(app.getHttpServer())
      .post("/api/v1/departments")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .set("Origin", process.env.CORS_ORIGIN ?? "http://localhost:3000")
      .send({ name: "CSRF-valid department" })
      .expect(201);
  });

  it("GET requests never require a CSRF token", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/appointments")
      .set("Cookie", clinic.sessions.CLINIC_ADMIN!.cookies)
      .expect(200);
  });

  it("login (no prior session) is CSRF-exempt by design — no csrf_token cookie can exist yet", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: clinic.sessions.CLINIC_ADMIN!.email,
        password: "wrong-password-doesnt-matter",
      })
      .expect(401); // reaches auth logic (not blocked by CSRF), fails on credentials instead
  });
});
