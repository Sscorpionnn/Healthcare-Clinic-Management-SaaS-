/**
 * Auth bypass — docs/test-strategy.md, docs/threat-model.md T3.
 * Requires a live Postgres + Redis stack; not executed in the authoring
 * environment (see tenant-isolation.e2e-spec.ts header for verification
 * details). Typechecked via `pnpm --filter api run typecheck:test`.
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  DiscoveryModule,
  DiscoveryService,
  MetadataScanner,
  Reflector,
} from "@nestjs/core";
import request from "supertest";
import jwt from "jsonwebtoken";
import { AppModule } from "../../src/app.module";
import { IS_PUBLIC_KEY } from "../../src/common/decorators/public.decorator";

/**
 * The complete, reviewed set of routes that never require a session.
 * Every route actually decorated `@Public()` in the running app must
 * match this set exactly — an addition here (or in the app) requires a
 * deliberate review, not an accidental "oops, forgot the guard".
 */
const EXPECTED_PUBLIC_ROUTES = new Set([
  "AuthController.login",
  "AuthController.selectClinic",
  "AuthController.refresh",
  "AuthController.acceptInvite",
  "AuthController.requestPasswordReset",
  "AuthController.confirmPasswordReset",
  "HealthController.check",
]);

describe("Auth bypass protections", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("the set of @Public() routes matches the reviewed allowlist exactly", async () => {
    const discovery = app.get(DiscoveryService);
    const scanner = app.get(MetadataScanner);
    const reflector = app.get(Reflector);

    const controllers = discovery.getControllers();
    const found = new Set<string>();

    for (const wrapper of controllers) {
      const { instance } = wrapper;
      if (!instance) continue;
      const prototype = Object.getPrototypeOf(instance);
      const methodNames = scanner.getAllMethodNames(prototype);
      for (const methodName of methodNames) {
        const handler = prototype[methodName];
        const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, handler);
        if (isPublic) {
          found.add(`${instance.constructor.name}.${methodName}`);
        }
      }
    }

    expect([...found].sort()).toEqual([...EXPECTED_PUBLIC_ROUTES].sort());
  });

  it("rejects a protected route with no access token", async () => {
    await request(app.getHttpServer()).get("/api/v1/patients").expect(401);
  });

  it("rejects a protected route with a malformed token", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/patients")
      .set("Cookie", ["access_token=not-a-real-jwt"])
      .expect(401);
  });

  it("rejects a protected route with an expired token", async () => {
    const expired = jwt.sign(
      { sub: "u1", isSuperAdmin: false },
      "wrong-secret-doesnt-matter-its-expired",
      { expiresIn: -10 },
    );
    await request(app.getHttpServer())
      .get("/api/v1/patients")
      .set("Cookie", [`access_token=${expired}`])
      .expect(401);
  });

  it("rejects a token signed with the wrong secret (tampered signature)", async () => {
    const forged = jwt.sign(
      {
        sub: "u1",
        isSuperAdmin: false,
        role: "CLINIC_ADMIN",
        clinicId: "any-clinic-id",
        membershipId: "any-membership-id",
      },
      "an-attacker-controlled-secret-not-the-real-one",
      { expiresIn: "15m" },
    );
    await request(app.getHttpServer())
      .get("/api/v1/patients")
      .set("Cookie", [`access_token=${forged}`])
      .expect(401);
  });

  it("rejects a token with an alg:none signature-stripping attempt", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "u1", isSuperAdmin: true }),
    ).toString("base64url");
    const noneToken = `${header}.${payload}.`;
    await request(app.getHttpServer())
      .get("/api/v1/patients")
      .set("Cookie", [`access_token=${noneToken}`])
      .expect(401);
  });

  it("health check remains reachable without a session (the one deliberately public non-auth route)", async () => {
    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
  });
});
