import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import type { AuthenticatedUser } from "../types/auth.types";

function makeContext(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  function makeGuard(requiredRoles: string[] | undefined) {
    const reflector = {
      getAllAndOverride: () => requiredRoles,
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it("allows any authenticated user when no @Roles() is set", () => {
    const guard = makeGuard(undefined);
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "RECEPTIONIST",
      clinicId: "c1",
      membershipId: "m1",
    };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it("denies a request with no authenticated user when roles are required", () => {
    const guard = makeGuard(["CLINIC_ADMIN"]);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it("allows a matching role", () => {
    const guard = makeGuard(["DOCTOR", "NURSE"]);
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "DOCTOR",
      clinicId: "c1",
      membershipId: "m1",
    };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it("throws ForbiddenException for a non-matching role", () => {
    const guard = makeGuard(["BILLING_MANAGER"]);
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "NURSE",
      clinicId: "c1",
      membershipId: "m1",
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it("allows SUPER_ADMIN only when SUPER_ADMIN is explicitly required", () => {
    const guard = makeGuard(["SUPER_ADMIN"]);
    const user: AuthenticatedUser = { sub: "u1", isSuperAdmin: true };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it("never allows SUPER_ADMIN into a clinic-role-gated route implicitly", () => {
    const guard = makeGuard(["CLINIC_ADMIN"]);
    const user: AuthenticatedUser = { sub: "u1", isSuperAdmin: true };
    expect(() => guard.canActivate(makeContext(user))).toThrow(
      ForbiddenException,
    );
  });
});
