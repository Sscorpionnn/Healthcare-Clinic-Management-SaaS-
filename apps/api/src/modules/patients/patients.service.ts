import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreatePatientInput, UpdatePatientInput } from "@clinic/shared";
import { encryptField, encryptOptionalField } from "@clinic/database";
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
import { toPatientView } from "./patients.view";

function encryptInput(input: Partial<CreatePatientInput>) {
  return {
    ...(input.firstName !== undefined && {
      firstName: encryptField(input.firstName),
    }),
    ...(input.lastName !== undefined && {
      lastName: encryptField(input.lastName),
    }),
    ...(input.dateOfBirth !== undefined && {
      dateOfBirth: encryptField(input.dateOfBirth),
    }),
    ...(input.phone !== undefined && {
      phone: encryptOptionalField(input.phone),
    }),
    ...(input.email !== undefined && {
      email: encryptOptionalField(input.email),
    }),
    ...(input.address !== undefined && {
      address: encryptOptionalField(JSON.stringify(input.address)),
    }),
    ...(input.emergencyContact !== undefined && {
      emergencyContact: encryptOptionalField(
        JSON.stringify(input.emergencyContact),
      ),
    }),
  };
}

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenant: TenantContext,
    input: CreatePatientInput,
    viewer: AuthenticatedUser,
  ) {
    const patient = await this.prisma.runTenant(tenant, (tx) =>
      tx.patientProfile.create({ data: encryptInput(input) as never }),
    );
    return toPatientView(patient, viewer);
  }

  async list(
    tenant: TenantContext,
    viewer: AuthenticatedUser,
    query: PaginationQuery,
  ) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      // DOCTOR sees only patients they're on the care team for — an
      // appointment or medical record together — not the whole clinic
      // roster. See docs/rbac.md, "read/write assigned".
      let patientIdFilter: string[] | undefined;
      if (viewer.role === "DOCTOR") {
        const doctor = await tx.doctorProfile.findFirst({
          where: { membershipId: viewer.membershipId },
        });
        const doctorId = doctor?.id ?? "__none__";
        const [appts, records] = await Promise.all([
          tx.appointment.findMany({
            where: { doctorId },
            select: { patientId: true },
          }),
          tx.medicalRecord.findMany({
            where: { doctorId },
            select: { patientId: true },
          }),
        ]);
        patientIdFilter = [
          ...new Set([
            ...appts.map((a) => a.patientId),
            ...records.map((r) => r.patientId),
          ]),
        ];
      }

      const where = {
        deletedAt: null,
        ...(patientIdFilter ? { id: { in: patientIdFilter } } : {}),
      };
      const [rows, total] = await Promise.all([
        tx.patientProfile.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { createdAt: "desc" },
        }),
        tx.patientProfile.count({ where }),
      ]);
      return paginated(
        rows.map((r) => toPatientView(r, viewer)),
        total,
        pagination,
      );
    });
  }

  async get(tenant: TenantContext, id: string, viewer: AuthenticatedUser) {
    const patient = await this.prisma.runTenant(tenant, (tx) =>
      tx.patientProfile.findFirst({ where: { id, deletedAt: null } }),
    );
    if (!patient) throw new NotFoundException();
    return toPatientView(patient, viewer);
  }

  async update(
    tenant: TenantContext,
    id: string,
    input: UpdatePatientInput,
    viewer: AuthenticatedUser,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.patientProfile.updateMany({
        where: { id, deletedAt: null },
        data: encryptInput(input) as never,
      });
      if (result.count === 0) throw new NotFoundException();
      const patient = await tx.patientProfile.findFirst({ where: { id } });
      return toPatientView(patient!, viewer);
    });
  }

  /** Soft delete only — hard erasure/anonymization happens via the deletion-requests workflow. See docs/privacy-model.md. */
  async remove(tenant: TenantContext, id: string) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.patientProfile.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) throw new NotFoundException();
    });
  }
}
