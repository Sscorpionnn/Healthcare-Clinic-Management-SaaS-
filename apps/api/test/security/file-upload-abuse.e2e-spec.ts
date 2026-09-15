/**
 * File upload abuse — docs/document-security.md, docs/threat-model.md T10.
 * Requires a live Postgres + Redis + MinIO (S3-compatible storage) stack;
 * not executed in the authoring environment (no Docker/MinIO available —
 * see tenant-isolation.e2e-spec.ts header). Typechecked via
 * `pnpm --filter api run typecheck:test`.
 *
 * Exercises the real two-phase flow: POST /documents/upload-intent for a
 * signed PUT URL, an actual PUT of bytes to that URL (against MinIO, not
 * mocked), then POST /documents/:id/complete — asserting rejection before
 * anything is promoted out of the quarantine bucket.
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
import { MAX_DOCUMENT_SIZE_BYTES } from "@clinic/shared";

// A minimal valid JPEG header (magic bytes) — used to simulate a file
// whose *declared* type (PDF) doesn't match its *actual* content (a
// classic polyglot/renamed-extension attack).
const JPEG_MAGIC_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);
const REAL_PDF_HEADER = Buffer.from(
  "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
  "binary",
);

function requestUploadIntent(
  app: INestApplication,
  cookies: string[],
  overrides: Record<string, unknown> = {},
) {
  return request(app.getHttpServer())
    .post("/api/v1/documents/upload-intent")
    .set("Cookie", cookies)
    .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
    .send({
      ownerPatientId: overrides.ownerPatientId,
      category: "CLINICAL",
      filename: "upload-test.pdf",
      declaredMimeType: "application/pdf",
      sizeBytes: REAL_PDF_HEADER.length,
      ...overrides,
    });
}

describe("File upload abuse resistance", () => {
  let app: INestApplication;
  let clinic: ClinicFixture;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    clinic = await seedClinicFixture(app, "upload");
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("rejects a declared MIME type outside the allowlist at upload-intent time (before any bytes move)", async () => {
    const cookies = clinic.sessions.DOCTOR!.cookies;
    await requestUploadIntent(app, cookies, {
      ownerPatientId: clinic.otherPatientProfileId,
      declaredMimeType: "text/html",
    }).expect(400);
  });

  it("rejects SVG explicitly (script-capable image type) even though it's image-shaped", async () => {
    const cookies = clinic.sessions.DOCTOR!.cookies;
    await requestUploadIntent(app, cookies, {
      ownerPatientId: clinic.otherPatientProfileId,
      declaredMimeType: "image/svg+xml",
      filename: "logo.svg",
    }).expect(400);
  });

  it("rejects a declared size over MAX_DOCUMENT_SIZE_BYTES at upload-intent time", async () => {
    const cookies = clinic.sessions.DOCTOR!.cookies;
    await requestUploadIntent(app, cookies, {
      ownerPatientId: clinic.otherPatientProfileId,
      sizeBytes: MAX_DOCUMENT_SIZE_BYTES + 1,
    }).expect(400);
  });

  it("rejects a polyglot: declared application/pdf, actual bytes are a JPEG — /complete rejects and it never reaches AVAILABLE", async () => {
    const cookies = clinic.sessions.DOCTOR!.cookies;
    const intentRes = await requestUploadIntent(app, cookies, {
      ownerPatientId: clinic.otherPatientProfileId,
      sizeBytes: JPEG_MAGIC_BYTES.length,
    }).expect(201);

    const putResponse = await fetch(intentRes.body.uploadUrl, {
      method: "PUT",
      body: JPEG_MAGIC_BYTES,
      headers: { "Content-Type": "application/pdf" },
    });
    expect(putResponse.ok).toBe(true);

    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/documents/${intentRes.body.documentId}/complete`)
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies));
    expect(completeRes.status).toBe(400);
  });

  it("rejects an oversized actual upload even when the declared size lied (real bytes exceed the cap)", async () => {
    const cookies = clinic.sessions.DOCTOR!.cookies;
    // Declare a small size to pass intent validation, then actually upload
    // more than MAX_DOCUMENT_SIZE_BYTES — /complete must catch the real size.
    const intentRes = await requestUploadIntent(app, cookies, {
      ownerPatientId: clinic.otherPatientProfileId,
      sizeBytes: 1024,
    }).expect(201);

    const oversized = Buffer.concat([
      REAL_PDF_HEADER,
      Buffer.alloc(MAX_DOCUMENT_SIZE_BYTES + 1024, 0x20),
    ]);
    const putResponse = await fetch(intentRes.body.uploadUrl, {
      method: "PUT",
      body: oversized,
      headers: { "Content-Type": "application/pdf" },
    });
    expect(putResponse.ok).toBe(true);

    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/documents/${intentRes.body.documentId}/complete`)
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies));
    expect(completeRes.status).toBe(400);
  }, 30_000);

  it("accepts a legitimate PDF whose declared and actual type match", async () => {
    const cookies = clinic.sessions.DOCTOR!.cookies;
    const intentRes = await requestUploadIntent(app, cookies, {
      ownerPatientId: clinic.otherPatientProfileId,
    }).expect(201);

    const putResponse = await fetch(intentRes.body.uploadUrl, {
      method: "PUT",
      body: REAL_PDF_HEADER,
      headers: { "Content-Type": "application/pdf" },
    });
    expect(putResponse.ok).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/documents/${intentRes.body.documentId}/complete`)
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFromCookies(cookies))
      .expect(201);
  });
});
