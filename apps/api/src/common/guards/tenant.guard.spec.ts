import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { TenantGuard } from "./tenant.guard";
import type { AuthenticatedUser } from "../types/auth.types";

function makeContext(user: AuthenticatedUser | undefined) {
  const request: { user?: AuthenticatedUser; tenant?: unknown } = { user };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("TenantGuard", () => {
  function makeGuard(isPlatformRoute: boolean) {
    const reflector = {
      getAllAndOverride: () => isPlatformRoute,
    } as unknown as Reflector;
    return new TenantGuard(reflector);
  }

  it("attaches tenant context from the verified clinicId claim, never from request input", () => {
    const guard = makeGuard(false);
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "DOCTOR",
      clinicId: "clinic-a",
      membershipId: "m1",
    };
    const { context, request } = makeContext(user);
    expect(guard.canActivate(context)).toBe(true);
    expect(request.tenant).toEqual({ clinicId: "clinic-a" });
  });

  it("rejects a SUPER_ADMIN token on an ordinary tenant route", () => {
    const guard = makeGuard(false);
    const user: AuthenticatedUser = { sub: "u1", isSuperAdmin: true };
    const { context } = makeContext(user);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("requires SUPER_ADMIN on a platform route and rejects everyone else", () => {
    const guard = makeGuard(true);
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "CLINIC_ADMIN",
      clinicId: "clinic-a",
      membershipId: "m1",
    };
    const { context } = makeContext(user);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("allows SUPER_ADMIN on a platform route", () => {
    const guard = makeGuard(true);
    const user: AuthenticatedUser = { sub: "u1", isSuperAdmin: true };
    const { context } = makeContext(user);
    expect(guard.canActivate(context)).toBe(true);
  });
});
