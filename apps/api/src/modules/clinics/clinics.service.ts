import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreateClinicInput, UpdateClinicInput } from "@clinic/shared";
import { hashPassword } from "@clinic/shared";
import { Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  parsePagination,
  paginated,
  type PaginationQuery,
} from "../../common/utils/pagination";
import { randomToken, sha256Hex } from "../../common/utils/hash";

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateClinicInput, actorUserId: string) {
    const existingSlug = await this.prisma.platform.clinic.findUnique({
      where: { slug: input.slug },
    });
    if (existingSlug)
      throw new ConflictException("A clinic with this slug already exists");

    const clinic = await this.prisma.platform.clinic.create({
      data: { name: input.name, slug: input.slug, timezone: input.timezone },
    });

    let user = await this.prisma.platform.user.findUnique({
      where: { email: input.adminEmail },
    });
    if (!user) {
      user = await this.prisma.platform.user.create({
        data: {
          email: input.adminEmail,
          passwordHash: await hashPassword(randomToken()),
          isActive: true,
        },
      });
    }

    const membership = await this.prisma.platform.membership.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
        role: "CLINIC_ADMIN",
        status: "INVITED",
      },
    });

    const rawInviteToken = randomToken();
    await this.prisma.platform.inviteToken.create({
      data: {
        membershipId: membership.id,
        tokenHash: sha256Hex(rawInviteToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // No SMTP integration is wired end-to-end in this repo — a real
    // deployment sends this via the notifications pipeline. Logged here
    // (never returned in the API response) so local/dev flows can proceed.
    this.logger.debug(
      `DEV ONLY invite token for ${input.adminEmail}: ${rawInviteToken}`,
    );

    await this.prisma.platform.auditLog.create({
      data: {
        clinicId: clinic.id,
        actorUserId,
        actorRole: "SUPER_ADMIN",
        action: "POST ClinicsController.create",
        resourceType: "Clinic",
        resourceId: clinic.id,
      },
    });

    return clinic;
  }

  async list(query: PaginationQuery) {
    const pagination = parsePagination(query);
    const [data, total] = await Promise.all([
      this.prisma.platform.clinic.findMany({
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.platform.clinic.count(),
    ]);
    return paginated(data, total, pagination);
  }

  async get(id: string) {
    const clinic = await this.prisma.platform.clinic.findUnique({
      where: { id },
    });
    if (!clinic) throw new NotFoundException();
    return clinic;
  }

  async update(id: string, input: UpdateClinicInput, actorUserId: string) {
    await this.get(id);
    const clinic = await this.prisma.platform.clinic.update({
      where: { id },
      data: input,
    });
    await this.prisma.platform.auditLog.create({
      data: {
        clinicId: id,
        actorUserId,
        actorRole: "SUPER_ADMIN",
        action: "PATCH ClinicsController.update",
        resourceType: "Clinic",
        resourceId: id,
      },
    });
    return clinic;
  }

  async suspend(id: string, reason: string, actorUserId: string) {
    await this.get(id);
    const clinic = await this.prisma.platform.clinic.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });
    await this.prisma.platform.auditLog.create({
      data: {
        clinicId: id,
        actorUserId,
        actorRole: "SUPER_ADMIN",
        action: "POST ClinicsController.suspend",
        resourceType: "Clinic",
        resourceId: id,
        metadata: { reason },
      },
    });
    return clinic;
  }
}
