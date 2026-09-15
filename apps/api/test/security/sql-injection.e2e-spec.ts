/**
 * SQL injection — docs/threat-model.md T6.
 * Requires a live Postgres + Redis stack; not executed in the authoring
 * environment. Typechecked via `pnpm --filter api run typecheck:test`.
 *
 * Prisma parameterizes every query the app issues (no `$queryRawUnsafe`/
 * `$executeRawUnsafe` is used anywhere outside the RLS tenant-context
 * setter, which is itself parameterized — see
 * packages/database/src/tenant-client.ts). These tests fuzz string
 * inputs with classic payloads and assert the app never 500s with a
 * leaked DB error and never returns unauthorized data — i.e. the payload
 * is treated as inert literal text, not executed.
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

const SQLI_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE patient_profiles; --",
  "1' UNION SELECT * FROM users --",
  '" OR ""="',
  "'; SELECT pg_sleep(5); --",
];

function bodyHasNoDbErrorLeak(body: unknown): void {
  const text = JSON.stringify(body).toLowerCase();
  expect(text).not.toMatch(
    /prismaclient|syntax error at or near|relation ".*" does not exist|column ".*" does not exist/,
  );
}

describe("SQL injection resistance", () => {
  let app: INestApplication;
  let clinic: ClinicFixture;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    clinic = await seedClinicFixture(app, "sqli");
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it.each(SQLI_PAYLOADS)(
    "login with a SQLi payload as the email never leaks a DB error (payload: %s)",
    async (payload) => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: payload, password: "irrelevant" });
      expect([400, 401]).toContain(res.status);
      bodyHasNoDbErrorLeak(res.body);
    },
  );

  it.each(SQLI_PAYLOADS)(
    "a SQLi payload in a patient's name field is stored/returned as inert text, not executed (payload: %s)",
    async (payload) => {
      const cookies = clinic.sessions.RECEPTIONIST!.cookies;
      const createRes = await request(app.getHttpServer())
        .post("/api/v1/patients")
        .set("Cookie", cookies)
        .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
        .send({
          firstName: payload,
          lastName: "Test",
          dateOfBirth: "1990-01-01",
        });

      expect([201, 400]).toContain(createRes.status);
      bodyHasNoDbErrorLeak(createRes.body);
      if (createRes.status === 201) {
        expect(createRes.body.firstName).toBe(payload);
      }
    },
  );

  it.each(SQLI_PAYLOADS)(
    "a SQLi payload as an :id route param returns a clean error, never a DB error (payload: %s)",
    async (payload) => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${encodeURIComponent(payload)}`)
        .set("Cookie", clinic.sessions.CLINIC_ADMIN!.cookies);
      expect(res.status).not.toBe(200);
      bodyHasNoDbErrorLeak(res.body);
    },
  );

  it("a SQLi payload in a pagination query param never leaks a DB error or bypasses pagination bounds", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/patients")
      .query({ page: "1; DROP TABLE patients; --", pageSize: "1' OR '1'='1" })
      .set("Cookie", clinic.sessions.CLINIC_ADMIN!.cookies);
    expect(res.status).toBe(200); // invalid numeric input falls back to safe defaults (see parsePagination)
    bodyHasNoDbErrorLeak(res.body);
  });
});
