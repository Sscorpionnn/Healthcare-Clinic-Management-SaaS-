import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateDepartmentInput } from "@clinic/shared";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { TenantContext } from "../../common/types/auth.types";
import {
  parsePagination,
  paginated,
  type PaginationQuery,
} from "../../common/utils/pagination";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenant: TenantContext, input: CreateDepartmentInput) {
    return this.prisma.runTenant(tenant, (tx) =>
      tx.department.create({ data: { ...input, clinicId: tenant.clinicId } }),
    );
  }

  async list(tenant: TenantContext, query: PaginationQuery) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      const [data, total] = await Promise.all([
        tx.department.findMany({
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { name: "asc" },
        }),
        tx.department.count(),
      ]);
      return paginated(data, total, pagination);
    });
  }

  async get(tenant: TenantContext, id: string) {
    const department = await this.prisma.runTenant(tenant, (tx) =>
      tx.department.findFirst({ where: { id } }),
    );
    if (!department) throw new NotFoundException();
    return department;
  }

  async update(
    tenant: TenantContext,
    id: string,
    input: Partial<CreateDepartmentInput>,
  ) {
    // update()/delete() by unique id are refused by the tenant-scoped
    // client extension (they can't safely have clinicId merged into a
    // unique `where`) — updateMany/deleteMany are the safe pattern; see
    // packages/database/src/tenant-client.ts.
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.department.updateMany({
        where: { id },
        data: input,
      });
      if (result.count === 0) throw new NotFoundException();
      return tx.department.findFirst({ where: { id } });
    });
  }

  async remove(tenant: TenantContext, id: string) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.department.deleteMany({ where: { id } });
      if (result.count === 0) throw new NotFoundException();
    });
  }
}
