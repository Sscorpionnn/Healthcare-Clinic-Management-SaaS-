/**
 * XSS — docs/threat-model.md T7.
 * Requires a live Postgres + Redis stack; not executed in the authoring
 * environment. Typechecked via `pnpm --filter api run typecheck:test`.
 *
 * This is a JSON API: it never renders HTML server-side, so the primary
 * automatable checks here are (1) a strict CSP with no `unsafe-inline`
 * script directive is present on every response — defense in depth for
 * the frontend that consumes this data — and (2) a script-shaped payload
 * stored in a text field round-trips as inert literal text (proving
 * nothing server-side interprets/executes it), never as `text/html`.
 * Escaping on render is the frontend's responsibility (React's default
 * escaping), out of this repo's backend test scope.
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

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)>",
  "javascript:alert(1)",
];

describe("XSS protections", () => {
  let app: INestApplication;
  let clinic: ClinicFixture;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    clinic = await seedClinicFixture(app, "xss");
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("every response carries a Content-Security-Policy with no unsafe-inline script directive", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200);
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src[^;]*'self'/);
    expect(csp).not.toMatch(/unsafe-inline/);
  });

  it("every response is JSON, never text/html (no HTML-rendering surface to inject into)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health");
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it.each(XSS_PAYLOADS)(
    "a script payload in a department name is stored and returned as inert literal text (payload: %s)",
    async (payload) => {
      const cookies = clinic.sessions.CLINIC_ADMIN!.cookies;
      const res = await request(app.getHttpServer())
        .post("/api/v1/departments")
        .set("Cookie", cookies)
        .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
        .send({ name: payload.slice(0, 100) })
        .expect(201);

      expect(res.body.name).toBe(payload.slice(0, 100));
      expect(res.headers["content-type"]).toMatch(/json/);

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/departments/${res.body.id}`)
        .set("Cookie", cookies)
        .expect(200);
      expect(getRes.body.name).toBe(payload.slice(0, 100));
    },
  );

  it("an appointment cancellation reason containing a script payload is stored verbatim, never executed or stripped silently", async () => {
    const cookies = clinic.sessions.CLINIC_ADMIN!.cookies;
    const payload = "<script>document.cookie</script>";
    const res = await request(app.getHttpServer())
      .post(`/api/v1/appointments/${clinic.appointmentId}/cancel`)
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .send({ cancelReason: payload })
      .expect(200);
    expect(res.body.cancelReason).toBe(payload);
  });
});
