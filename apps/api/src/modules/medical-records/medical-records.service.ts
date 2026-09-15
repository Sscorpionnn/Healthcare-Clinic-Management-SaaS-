import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateMedicalRecordInput,
  FinalizeMedicalRecordInput,
} from "@clinic/shared";
import {
  decryptOptionalField,
  encryptField,
  encryptOptionalField,
} from "@clinic/database";
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

function view<
  T extends { chiefComplaint: string | null; diagnosisNotes: string | null },
>(record: T) {
  return {
    ...record,
    chiefComplaint: decryptOptionalField(record.chiefComplaint),
    diagnosisNotes: decryptOptionalField(record.diagnosisNotes),
  };
}

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenant: TenantContext,
    input: CreateMedicalRecordInput,
    viewer: AuthenticatedUser,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const doctor = await tx.doctorProfile.findFirst({
        where: { membershipId: viewer.membershipId },
      });
      if (!doctor)
        throw new BadRequestException(
          "Only a doctor can open a medical record",
        );

      const patient = await tx.patientProfile.findFirst({
        where: { id: input.patientId, deletedAt: null },
      });
      if (!patient) throw new NotFoundException("Patient not found");

      const record = await tx.medicalRecord.create({
        data: {
          clinicId: tenant.clinicId,
          patientId: input.patientId,
          doctorId: doctor.id,
          appointmentId: input.appointmentId,
          visitDate: input.visitDate,
          chiefComplaint: encryptOptionalField(input.chiefComplaint),
          diagnosisNotes: encryptOptionalField(input.diagnosisNotes),
        },
      });
      return view(record);
    });
  }

  async list(
    tenant: TenantContext,
    viewer: AuthenticatedUser,
    query: PaginationQuery & { patientId?: string },
  ) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      let where: Record<string, unknown> = query.patientId
        ? { patientId: query.patientId }
        : {};
      if (viewer.role === "DOCTOR") {
        const doctor = await tx.doctorProfile.findFirst({
          where: { membershipId: viewer.membershipId },
        });
        where = { ...where, doctorId: doctor?.id ?? "__none__" };
      } else if (viewer.role === "PATIENT") {
        const patient = await tx.patientProfile.findFirst({
          where: { userId: viewer.sub },
        });
        where = { ...where, patientId: patient?.id ?? "__none__" };
      }
      const [rows, total] = await Promise.all([
        tx.medicalRecord.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { visitDate: "desc" },
        }),
        tx.medicalRecord.count({ where }),
      ]);
      return paginated(rows.map(view), total, pagination);
    });
  }

  async get(tenant: TenantContext, id: string) {
    const record = await this.prisma.runTenant(tenant, (tx) =>
      tx.medicalRecord.findFirst({ where: { id } }),
    );
    if (!record) throw new NotFoundException();
    return view(record);
  }

  async finalize(
    tenant: TenantContext,
    id: string,
    input: FinalizeMedicalRecordInput,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const existing = await tx.medicalRecord.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException();
      if (existing.status === "FINALIZED")
        throw new ConflictException("Record is already finalized");

      const result = await tx.medicalRecord.updateMany({
        where: { id },
        data: {
          status: "FINALIZED",
          diagnosisNotes: encryptField(input.diagnosisNotes),
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new NotFoundException();
      const record = await tx.medicalRecord.findFirst({ where: { id } });
      return view(record!);
    });
  }
}
