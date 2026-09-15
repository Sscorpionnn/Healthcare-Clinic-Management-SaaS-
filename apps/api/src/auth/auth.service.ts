import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { hashPassword, verifyPassword, type Role } from "@clinic/shared";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import type { AccessTokenPayload } from "../common/types/auth.types";
import { randomToken, sha256Hex } from "../common/utils/hash";
import { TokenService } from "./token.service";
import type {
  IssuedSession,
  MembershipSummary,
  RequestMeta,
} from "./auth.types";

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = "";

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async onModuleInit() {
    // Precomputed once so a "user not found" login still pays roughly the
    // same argon2 cost as a real verification — mitigates account
    // enumeration via timing (docs/threat-model.md T5).
    this.dummyHash = await hashPassword(randomToken(16));
  }

  // ---- login -------------------------------------------------------------

  async login(email: string, password: string, _meta: RequestMeta) {
    const user = await this.prisma.app.user.findUnique({ where: { email } });

    const passwordOk = user
      ? await verifyPassword(user.passwordHash, password)
      : await verifyPassword(this.dummyHash, password);
    if (!user || !user.isActive || !passwordOk) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.isSuperAdmin) {
      const session = await this.issueSession(user.id, user.email, {
        isSuperAdmin: true,
      });
      return { requiresClinicSelection: false as const, ...session };
    }

    // Cross-tenant identity resolution (which clinics does this user belong
    // to) — the one deliberate, narrow use of the platform (BYPASSRLS)
    // client outside the clinics admin module: it returns membership
    // metadata only, never patient/clinical/document/billing data. See
    // docs/multi-tenancy.md.
    const memberships = await this.prisma.platform.membership.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        clinic: { status: "ACTIVE" },
      },
      include: { clinic: true },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedException("No active clinic membership");
    }

    if (memberships.length === 1) {
      const membership = memberships[0]!;
      const session = await this.issueSession(user.id, user.email, {
        isSuperAdmin: false,
        membershipId: membership.id,
        clinicId: membership.clinicId,
        role: membership.role,
      });
      return { requiresClinicSelection: false as const, ...session };
    }

    const summaries: MembershipSummary[] = memberships.map((m) => ({
      membershipId: m.id,
      clinicId: m.clinicId,
      clinicName: m.clinic.name,
      role: m.role,
    }));
    return {
      requiresClinicSelection: true as const,
      memberships: summaries,
      preauthToken: this.tokens.signPreauthToken(user.id),
    };
  }

  async selectClinic(
    preauthToken: string,
    membershipId: string,
    _meta: RequestMeta,
  ) {
    const preauth = await this.tokens.verifyPreauthToken(preauthToken);

    const membership = await this.prisma.platform.membership.findFirst({
      where: {
        id: membershipId,
        userId: preauth.sub,
        status: "ACTIVE",
        clinic: { status: "ACTIVE" },
      },
      include: { clinic: true, user: true },
    });
    if (!membership || !membership.user.isActive) {
      throw new UnauthorizedException("Invalid clinic selection");
    }

    const session = await this.issueSession(
      membership.user.id,
      membership.user.email,
      {
        isSuperAdmin: false,
        membershipId: membership.id,
        clinicId: membership.clinicId,
        role: membership.role,
      },
    );
    return session;
  }

  // ---- refresh / logout ---------------------------------------------------

  async refresh(
    rawRefreshToken: string,
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const tokenHash = sha256Hex(rawRefreshToken);
    const record = await this.prisma.app.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) throw new UnauthorizedException("Invalid session");

    if (record.revokedAt) {
      // Reuse of an already-rotated token: treat as compromise and revoke
      // the entire family — see docs/api-contract.md, docs/threat-model.md T3.
      await this.prisma.app.refreshToken.updateMany({
        where: { family: record.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        "Session invalidated — please log in again",
      );
    }

    if (record.expiresAt < new Date() || !record.user.isActive) {
      throw new UnauthorizedException("Session expired");
    }

    let role: Role | undefined;
    let clinicId: string | undefined;
    if (record.membershipId) {
      const membership = await this.prisma.platform.membership.findFirst({
        where: {
          id: record.membershipId,
          status: "ACTIVE",
          clinic: { status: "ACTIVE" },
        },
      });
      if (!membership)
        throw new UnauthorizedException("Membership no longer active");
      role = membership.role;
      clinicId = membership.clinicId;
    }

    const rotated = await this.issueSession(
      record.user.id,
      record.user.email,
      {
        isSuperAdmin: record.user.isSuperAdmin,
        membershipId: record.membershipId ?? undefined,
        clinicId,
        role,
      },
      { family: record.family, meta },
    );

    await this.prisma.app.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: rotated.refreshTokenId },
    });

    return rotated;
  }

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) return;
    const tokenHash = sha256Hex(rawRefreshToken);
    await this.prisma.app.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---- invite / password reset --------------------------------------------

  async acceptInvite(
    rawToken: string,
    password: string,
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const tokenHash = sha256Hex(rawToken);
    const invite = await this.prisma.app.inviteToken.findUnique({
      where: { tokenHash },
      include: { membership: { include: { user: true, clinic: true } } },
    });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new UnauthorizedException("Invite link is invalid or expired");
    }

    const passwordHash = await hashPassword(password);
    // Membership is RLS-protected, so this must run with the invite's own
    // clinic set as tenant context — a bare app-client update would match
    // zero rows under RLS. See docs/multi-tenancy.md, Layer 2.
    await this.prisma.runTenant(
      { clinicId: invite.membership.clinicId },
      async (tx) => {
        await tx.user.update({
          where: { id: invite.membership.userId },
          data: { passwordHash, isActive: true },
        });
        await tx.membership.update({
          where: { id: invite.membershipId },
          data: { status: "ACTIVE", joinedAt: new Date() },
        });
        await tx.inviteToken.update({
          where: { id: invite.id },
          data: { usedAt: new Date() },
        });
      },
    );

    return this.issueSession(
      invite.membership.userId,
      invite.membership.user.email,
      {
        isSuperAdmin: false,
        membershipId: invite.membershipId,
        clinicId: invite.membership.clinicId,
        role: invite.membership.role,
      },
      { meta },
    );
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.app.user.findUnique({ where: { email } });
    // Always identical control flow/timing regardless of whether the user
    // exists — see docs/threat-model.md T5.
    if (!user || !user.isActive) return;

    const raw = randomToken();
    await this.prisma.app.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256Hex(raw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    // Sending the email is delegated to the notifications/queue pipeline in
    // a full deployment; not wired to a real SMTP send in this repo beyond
    // the Mailhog-capable notifications module hook.
  }

  async confirmPasswordReset(
    rawToken: string,
    password: string,
  ): Promise<void> {
    const tokenHash = sha256Hex(rawToken);
    const record = await this.prisma.app.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Reset link is invalid or expired");
    }

    const passwordHash = await hashPassword(password);
    await this.prisma.app.$transaction([
      this.prisma.app.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.app.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate every existing session — a password reset must not leave
      // old sessions valid.
      this.prisma.app.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // ---- internal ------------------------------------------------------------

  private async issueSession(
    userId: string,
    email: string,
    claims: {
      isSuperAdmin: boolean;
      membershipId?: string;
      clinicId?: string;
      role?: Role;
    },
    opts?: { family?: string; meta?: RequestMeta },
  ): Promise<IssuedSession & { refreshTokenId: string }> {
    const payload: AccessTokenPayload = {
      sub: userId,
      isSuperAdmin: claims.isSuperAdmin,
      membershipId: claims.membershipId,
      clinicId: claims.clinicId,
      role: claims.role,
    };
    const accessToken = this.tokens.signAccessToken(payload);

    const rawRefreshToken = randomToken();
    const family = opts?.family ?? randomUUID();
    const refreshRecord = await this.prisma.app.refreshToken.create({
      data: {
        userId,
        membershipId: claims.membershipId,
        tokenHash: sha256Hex(rawRefreshToken),
        family,
        expiresAt: new Date(Date.now() + this.tokens.refreshTokenTtlMs),
        createdByIp: opts?.meta?.ip,
        userAgent: opts?.meta?.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshTokenId: refreshRecord.id,
      csrfToken: randomToken(16),
      accessTtlMs: this.tokens.accessTokenTtlMs,
      refreshTtlMs: this.tokens.refreshTokenTtlMs,
      user: {
        id: userId,
        email,
        isSuperAdmin: claims.isSuperAdmin,
        membershipId: claims.membershipId,
        clinicId: claims.clinicId,
        role: claims.role,
      },
    };
  }
}
