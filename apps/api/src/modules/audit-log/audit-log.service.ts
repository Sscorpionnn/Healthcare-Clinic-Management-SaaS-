import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { TenantContext } from "../../common/types/auth.types";
import {
  parsePagination,
  paginated,
  type PaginationQuery,
} from "../../common/utils/pagination";

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async listForClinic(tenant: TenantContext, query: PaginationQuery) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      const [data, total] = await Promise.all([
        tx.auditLog.findMany({
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { createdAt: "desc" },
        }),
        tx.auditLog.count(),
      ]);
      return paginated(data, total, pagination);
    });
  }

  /** Platform-wide, metadata only — never clinical resource detail. SUPER_ADMIN via BYPASSRLS client. */
  async listForPlatform(query: PaginationQuery) {
    const pagination = parsePagination(query);
    const [data, total] = await Promise.all([
      this.prisma.platform.auditLog.findMany({
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          clinicId: true,
          actorUserId: true,
          actorRole: true,
          action: true,
          resourceType: true,
          resourceId: true,
          createdAt: true,
        },
      }),
      this.prisma.platform.auditLog.count(),
    ]);
    return paginated(data, total, pagination);
  }
}
