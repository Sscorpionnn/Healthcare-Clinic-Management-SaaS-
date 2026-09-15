import type { Role } from "@clinic/shared";

/** Signed access-token claims. `clinicId`/`role`/`membershipId` are absent for a SUPER_ADMIN platform token. */
export interface AccessTokenPayload {
  sub: string; // userId
  membershipId?: string;
  clinicId?: string;
  role?: Role;
  isSuperAdmin: boolean;
}

export interface PreauthTokenPayload {
  sub: string; // userId
  purpose: "clinic-selection";
}

/** Attached to the request by AuthGuard after verification. */
export type AuthenticatedUser = AccessTokenPayload;

export interface TenantContext {
  clinicId: string;
}
