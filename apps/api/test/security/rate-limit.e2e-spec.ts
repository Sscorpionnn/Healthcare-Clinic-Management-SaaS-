/**
 * Brute force / rate-limit — docs/threat-model.md T4/T13.
 * Requires a live Postgres + Redis stack; not executed in the authoring
 * environment. Typechecked via `pnpm --filter api run typecheck:test`.
 *
 * Uses the real `RATE_LIMIT_LOGIN_MAX`/`RATE_LIMIT_LOGIN_WINDOW_SECONDS`
 * env values so the threshold this test asserts always matches whatever
 * the environment is actually configured with (see .env.example).
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";

describe("Login rate limiting", () => {
  let app: INestApplication;
  const max = Number(process.env.RATE_LIMIT_LOGIN_MAX ?? 5);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it(`locks out after ${max} failed login attempts for the same account and returns 429`, async () => {
    const email = `rate-limit-target-${Date.now()}@example.test`;

    const statuses: number[] = [];
    for (let i = 0; i < max + 2; i += 1) {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "wrong-password" });
      statuses.push(res.status);
    }

    // The first `max` attempts fail on credentials (401, no such account);
    // once the threshold is crossed, the guard itself rejects with 429
    // before auth logic even runs.
    expect(statuses.slice(0, max)).toEqual(Array(max).fill(401));
    expect(statuses[max]).toBe(429);
    expect(statuses[max + 1]).toBe(429);
  });

  it("rate limiting is also keyed per-IP, not only per-account (distinct emails from the same client still lock out)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < max + 2; i += 1) {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: `distinct-target-${i}-${Date.now()}@example.test`,
          password: "wrong-password",
        });
      statuses.push(res.status);
    }
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});
