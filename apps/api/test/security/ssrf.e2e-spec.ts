/**
 * SSRF — docs/threat-model.md T9.
 *
 * This is a static audit, not a live-DB test: it scans every Zod schema
 * in `@clinic/shared` (the single source of truth for every writable DTO
 * in the API — see docs/api-contract.md) for any URL-accepting field
 * (`z.string().url()`, a field literally named `url`/`webhookUrl`/
 * `callbackUrl`/`avatarUrl`, etc). Per docs/threat-model.md T9, this API
 * has no user-supplied-URL server-side-fetch feature by design — no
 * avatar-by-URL, no webhook registration, nothing that would make the
 * server issue an outbound request to an attacker-influenced address.
 *
 * Rather than writing a test against an SSRF-vulnerable endpoint that
 * doesn't exist (which the review explicitly asked not to fake), this
 * spec makes that absence an enforced, automated invariant: if anyone
 * ever adds a URL-shaped field to a shared schema, this test starts
 * failing and forces a deliberate SSRF-mitigation review (allowlist,
 * DNS-rebind-safe resolution, private-IP blocking) before it can ship.
 *
 * Runs with zero external dependencies (no DB/Redis/Docker needed) — this
 * one WAS executed in the authoring environment; see the assertion below.
 */
import * as sharedSchemas from "@clinic/shared";
import { z } from "zod";

const SUSPICIOUS_FIELD_NAMES = /url|uri|webhook|callback|endpoint|href|src$/i;

function walk(
  schema: unknown,
  path: string,
  issues: string[],
  seen = new Set<unknown>(),
): void {
  if (!schema || typeof schema !== "object" || seen.has(schema)) return;
  seen.add(schema);

  if (schema instanceof z.ZodString) {
    // z.string().url() stores a "url" check in its `_def.checks`.
    const checks =
      (schema as unknown as { _def?: { checks?: { kind: string }[] } })._def
        ?.checks ?? [];
    if (checks.some((c) => c.kind === "url")) {
      issues.push(
        `${path}: z.string().url() field — server-side fetch from this value needs SSRF mitigation`,
      );
    }
    return;
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, unknown>;
    for (const [key, value] of Object.entries(shape)) {
      if (SUSPICIOUS_FIELD_NAMES.test(key)) {
        issues.push(
          `${path}.${key}: field name suggests a URL — verify it isn't used for a server-side fetch`,
        );
      }
      walk(value, `${path}.${key}`, issues, seen);
    }
    return;
  }

  const inner = (
    schema as {
      _def?: { innerType?: unknown; schema?: unknown; type?: unknown };
    }
  )._def;
  if (inner?.innerType) walk(inner.innerType, path, issues, seen);
  if (inner?.schema) walk(inner.schema, path, issues, seen);
}

describe("SSRF surface audit (static, no live services required)", () => {
  it("no shared Zod schema accepts a URL-shaped field today — API has no user-supplied-URL server-fetch feature", () => {
    const issues: string[] = [];
    for (const [name, value] of Object.entries(sharedSchemas)) {
      if (value instanceof z.ZodType) {
        walk(value, name, issues);
      }
    }
    expect(issues).toEqual([]);
  });
});
