import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword, type InviteStaffInput } from "@clinic/shared";
import { encryptField } from "@clinic/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { TenantContext } from "../../common/types/auth.types";
import { randomToken, sha256Hex } from "../../common/utils/hash";
import {
  parsePagination,
  paginated,
  type PaginationQuery,
} from "../../common/utils/pagination";

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly prisma: PrismaService) {}

  async invite(tenant: TenantContext, input: InviteStaffInput) {
    if (input.role === "DOCTOR" && (!input.specialty || !input.licenseNumber)) {
      throw new BadRequestException(
        "specialty and licenseNumber are required to invite a DOCTOR",
      );
    }

    // User identity is cross-tenant (a person can staff multiple clinics),
    // so lookup/creation goes through the platform client — read-only
    // identity resolution, never patient/clinical data. The Membership
    // itself is created inside tenant context, RLS-protected.
    let user = await this.prisma.platform.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      user = await this.prisma.platform.user.create({
        data: {
          email: input.email,
          passwordHash: await hashPassword(randomToken()),
          isActive: true,
        },
      });
    }

    const existing = await this.prisma.platform.membership.findUnique({
      where: {
        userId_clinicId: { userId: user.id, clinicId: tenant.clinicId },
      },
    });
    if (existing)
      throw new ConflictException(
        "This person already has a membership at this clinic",
      );

    const membership = await this.prisma.runTenant(tenant, (tx) =>
      tx.membership.create({
        data: {
          userId: user!.id,
          clinicId: tenant.clinicId,
          role: input.role,
          departmentId: input.departmentId,
          status: "INVITED",
        },
      }),
    );

    if (input.role === "DOCTOR") {
      await this.prisma.runTenant(tenant, (tx) =>
        tx.doctorProfile.create({
          data: {
            clinicId: tenant.clinicId,
            membershipId: membership.id,
            specialty: input.specialty!,
            licenseNumber: encryptField(input.licenseNumber!),
          },
        }),
      );
    }

    const rawInviteToken = randomToken();
    await this.prisma.app.inviteToken.create({
      data: {
        membershipId: membership.id,
        tokenHash: sha256Hex(rawInviteToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    this.logger.debug(
      `DEV ONLY invite token for ${input.email}: ${rawInviteToken}`,
    );

    return membership;
  }

  async list(tenant: TenantContext, query: PaginationQuery) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      const [data, total] = await Promise.all([
        tx.membership.findMany({
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { email: true, isActive: true } },
            department: true,
          },
        }),
        tx.membership.count(),
      ]);
      return paginated(data, total, pagination);
    });
  }

  async updateRole(
    tenant: TenantContext,
    membershipId: string,
    role: InviteStaffInput["role"],
    actorMembershipId: string | undefined,
  ) {
    if (membershipId === actorMembershipId) {
      throw new ForbiddenException("Cannot change your own role");
    }
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.membership.updateMany({
        where: { id: membershipId },
        data: { role },
      });
      if (result.count === 0) throw new NotFoundException();
      return tx.membership.findFirst({ where: { id: membershipId } });
    });
  }

  async suspend(
    tenant: TenantContext,
    membershipId: string,
    actorMembershipId: string | undefined,
  ) {
    if (membershipId === actorMembershipId) {
      throw new ForbiddenException("Cannot suspend your own membership");
    }
    const membership = await this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.membership.updateMany({
        where: { id: membershipId },
        data: { status: "SUSPENDED" },
      });
      if (result.count === 0) throw new NotFoundException();
      return tx.membership.findFirst({ where: { id: membershipId } });
    });

    // Immediate session revocation — see docs/multi-tenancy.md, Suspension.
    await this.prisma.app.refreshToken.updateMany({
      where: { userId: membership!.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return membership;
  }
}
