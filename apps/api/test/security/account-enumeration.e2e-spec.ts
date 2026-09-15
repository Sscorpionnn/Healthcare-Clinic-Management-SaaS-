/**
 * Account enumeration — docs/threat-model.md T5.
 * Requires a live Postgres + Redis stack; not executed in the authoring
 * environment. Typechecked via `pnpm --filter api run typecheck:test`.
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import {
  FIXTURE_PASSWORD,
  seedClinicFixture,
  type ClinicFixture,
} from "../fixtures/clinic-fixture";

describe("Account enumeration resistance", () => {
  let app: INestApplication;
  let clinic: ClinicFixture;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    clinic = await seedClinicFixture(app, "enum");
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("login returns the same status and error shape for a wrong password on a real account vs. a nonexistent account", async () => {
    const realAccount = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: clinic.sessions.CLINIC_ADMIN!.email,
        password: "definitely-the-wrong-password",
      });

    const fakeAccount = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: "no-such-account-exists@example.test",
        password: "anything-at-all",
      });

    expect(realAccount.status).toBe(fakeAccount.status);
    expect(Object.keys(realAccount.body).sort()).toEqual(
      Object.keys(fakeAccount.body).sort(),
    );
    // Bodies must not differ in a way that reveals which branch was taken
    // (e.g. "invalid password" vs "no such user").
    expect(realAccount.body.title).toEqual(fakeAccount.body.title);
  });

  it("password-reset request returns identical 202 responses for a real vs. nonexistent email", async () => {
    const realAccount = await request(app.getHttpServer())
      .post("/api/v1/auth/password-reset/request")
      .send({ email: clinic.sessions.PATIENT!.email });

    const fakeAccount = await request(app.getHttpServer())
      .post("/api/v1/auth/password-reset/request")
      .send({ email: "no-such-account-exists@example.test" });

    expect(realAccount.status).toBe(202);
    expect(fakeAccount.status).toBe(202);
    expect(realAccount.body).toEqual(fakeAccount.body);
  });

  it("login response timing for a real vs. fake account does not differ by more than a generous bound (coarse timing-safety smoke check)", async () => {
    const timeIt = async (email: string) => {
      const start = Date.now();
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "wrong-password" });
      return Date.now() - start;
    };

    // Averaged over a few runs to reduce noise; this is a coarse smoke
    // check (argon2 dummy-hash comparison — see AuthService), not a
    // statistically rigorous timing-attack proof.
    const realTimes: number[] = [];
    const fakeTimes: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      realTimes.push(await timeIt(clinic.sessions.CLINIC_ADMIN!.email));
      fakeTimes.push(await timeIt(`no-such-user-${i}@example.test`));
    }
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const realAvg = avg(realTimes);
    const fakeAvg = avg(fakeTimes);
    expect(Math.abs(realAvg - fakeAvg)).toBeLessThan(
      Math.max(realAvg, fakeAvg) * 0.5 + 50,
    );
  });

  it("accept-invite with a bogus token returns the same generic error as an expired/used one would", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/invite/accept")
      .send({
        token: "totally-made-up-token-value",
        password: `${FIXTURE_PASSWORD}x`,
      });
    expect(res.status).toBe(401);
    expect(res.body.title).toMatch(/invalid|expired/i);
  });
});
