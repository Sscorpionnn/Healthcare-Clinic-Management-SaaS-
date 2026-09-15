import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { CsrfGuard } from "./csrf.guard";

function makeContext(opts: {
  method: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: opts.method,
        cookies: opts.cookies ?? {},
        headers: opts.headers ?? {},
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("CsrfGuard", () => {
  function makeGuard(skip: boolean, corsOrigin = "http://localhost:3000") {
    const reflector = { getAllAndOverride: () => skip } as unknown as Reflector;
    const config = { get: () => corsOrigin } as unknown as ConfigService;
    return new CsrfGuard(reflector, config);
  }

  it("allows a GET request without a CSRF token", () => {
    const guard = makeGuard(false);
    expect(guard.canActivate(makeContext({ method: "GET" }))).toBe(true);
  });

  it("allows a @SkipCsrf() route regardless of tokens", () => {
    const guard = makeGuard(true);
    expect(guard.canActivate(makeContext({ method: "POST" }))).toBe(true);
  });

  it("rejects a mutating request with no CSRF cookie/header", () => {
    const guard = makeGuard(false);
    expect(() => guard.canActivate(makeContext({ method: "POST" }))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects a mutating request when the header doesn't match the cookie", () => {
    const guard = makeGuard(false);
    const context = makeContext({
      method: "POST",
      cookies: { csrf_token: "abc123" },
      headers: {
        "x-csrf-token": "different-value",
        origin: "http://localhost:3000",
      },
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("allows a mutating request when the header matches the cookie and origin is allowed", () => {
    const guard = makeGuard(false);
    const context = makeContext({
      method: "POST",
      cookies: { csrf_token: "abc123" },
      headers: { "x-csrf-token": "abc123", origin: "http://localhost:3000" },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a mutating request from a disallowed origin even with a matching token", () => {
    const guard = makeGuard(false);
    const context = makeContext({
      method: "POST",
      cookies: { csrf_token: "abc123" },
      headers: { "x-csrf-token": "abc123", origin: "https://evil.example" },
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
