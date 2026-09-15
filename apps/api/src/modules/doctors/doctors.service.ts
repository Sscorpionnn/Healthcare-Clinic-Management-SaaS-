import { Injectable, NotFoundException } from "@nestjs/common";
import { decryptField } from "@clinic/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import {
  parsePagination,
  paginated,
  type PaginationQuery,
} from "../../common/utils/pagination";

function project(
  doctor: {
    id: string;
    specialty: string;
    bio: string | null;
    licenseNumber: string;
    membershipId: string;
    membership: { user: { email: string } };
  },
  viewer: AuthenticatedUser,
) {
  const canSeeLicense =
    viewer.role === "CLINIC_ADMIN" ||
    viewer.membershipId === doctor.membershipId;
  return {
    id: doctor.id,
    membershipId: doctor.membershipId,
    specialty: doctor.specialty,
    bio: doctor.bio,
    email: doctor.membership.user.email,
    licenseNumber: canSeeLicense
      ? decryptField(doctor.licenseNumber)
      : undefined,
  };
}

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenant: TenantContext,
    viewer: AuthenticatedUser,
    query: PaginationQuery,
  ) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.doctorProfile.findMany({
          skip: pagination.skip,
          take: pagination.take,
          include: {
            membership: { include: { user: { select: { email: true } } } },
          },
        }),
        tx.doctorProfile.count(),
      ]);
      return paginated(
        rows.map((r) => project(r, viewer)),
        total,
        pagination,
      );
    });
  }

  async get(tenant: TenantContext, id: string, viewer: AuthenticatedUser) {
    const doctor = await this.prisma.runTenant(tenant, (tx) =>
      tx.doctorProfile.findFirst({
        where: { id },
        include: {
          membership: { include: { user: { select: { email: true } } } },
        },
      }),
    );
    if (!doctor) throw new NotFoundException();
    return project(doctor, viewer);
  }

  async update(
    tenant: TenantContext,
    id: string,
    input: { specialty?: string; bio?: string },
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.doctorProfile.updateMany({
        where: { id },
        data: input,
      });
      if (result.count === 0) throw new NotFoundException();
      return tx.doctorProfile.findFirst({ where: { id } });
    });
  }
}
