import type { Role } from "@clinic/shared";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface MembershipSummary {
  membershipId: string;
  clinicId: string;
  clinicName: string;
  role: Role;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessTtlMs: number;
  refreshTtlMs: number;
  user: {
    id: string;
    email: string;
    isSuperAdmin: boolean;
    membershipId?: string;
    clinicId?: string;
    role?: Role;
  };
}

export type LoginResult =
  | {
      requiresClinicSelection: true;
      memberships: MembershipSummary[];
      preauthToken: string;
    }
  | ({ requiresClinicSelection: false } & IssuedSession);
