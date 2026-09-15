import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { encryptField } from "@clinic/database";
import { randomUUID } from "node:crypto";
import type {
  CreateDeletionRequestInput,
  ReviewDeletionRequestInput,
} from "@clinic/shared";
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

@Injectable()
export class DeletionRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenant: TenantContext,
    input: CreateDeletionRequestInput,
    viewer: AuthenticatedUser,
  ) {
    let subjectPatientId = input.subjectPatientId;

    if (viewer.role === "PATIENT") {
      const patient = await this.prisma.runTenant(tenant, (tx) =>
        tx.patientProfile.findFirst({ where: { userId: viewer.sub } }),
      );
      if (!patient)
        throw new BadRequestException(
          "No patient profile linked to this account",
        );
      subjectPatientId = patient.id;
    } else if (viewer.role !== "CLINIC_ADMIN") {
      throw new ForbiddenException();
    }

    if (input.subjectType === "PATIENT" && !subjectPatientId) {
      throw new BadRequestException(
        "subjectPatientId is required for a PATIENT-subject deletion request",
      );
    }

    return this.prisma.runTenant(tenant, (tx) =>
      tx.deletionRequest.create({
        data: {
          clinicId: tenant.clinicId,
          requestedByUserId: viewer.sub,
          subjectType: input.subjectType,
          subjectPatientId,
          retentionHoldReason: input.reason,
        },
      }),
    );
  }

  async list(
    tenant: TenantContext,
    viewer: AuthenticatedUser,
    query: PaginationQuery,
  ) {
    const pagination = parsePagination(query);
    const where =
      viewer.role === "CLINIC_ADMIN" ? {} : { requestedByUserId: viewer.sub };
    return this.prisma.runTenant(tenant, async (tx) => {
      const [data, total] = await Promise.all([
        tx.deletionRequest.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { createdAt: "desc" },
        }),
        tx.deletionRequest.count({ where }),
      ]);
      return paginated(data, total, pagination);
    });
  }

  async review(
    tenant: TenantContext,
    id: string,
    input: ReviewDeletionRequestInput,
    reviewerUserId: string,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const request = await tx.deletionRequest.findFirst({ where: { id } });
      if (!request) throw new NotFoundException();
      if (request.status !== "PENDING_REVIEW")
        throw new BadRequestException("Request has already been reviewed");

      if (input.decision === "REJECTED") {
        await tx.deletionRequest.updateMany({
          where: { id },
          data: {
            status: "REJECTED",
            reviewedByUserId: reviewerUserId,
            retentionHoldReason: input.retentionHoldReason,
          },
        });
        return tx.deletionRequest.findFirst({ where: { id } });
      }

      // Approved: anonymize rather than hard-delete, so referential
      // integrity (appointments/records/invoices) and the audit trail
      // survive while the patient is no longer identifiable — see
      // docs/privacy-model.md, Erasure. A retentionHoldReason on the
      // request records *why* anonymization (not deletion) was used when
      // clinically-retained data exists.
      if (request.subjectPatientId) {
        const token = randomUUID();
        await tx.patientProfile.updateMany({
          where: { id: request.subjectPatientId },
          data: {
            firstName: encryptField(`erased-${token}`),
            lastName: encryptField("erased"),
            phone: null,
            email: null,
            address: null,
            emergencyContact: null,
            deletedAt: new Date(),
          },
        });
      }

      await tx.deletionRequest.updateMany({
        where: { id },
        data: {
          status: "COMPLETED",
          reviewedByUserId: reviewerUserId,
          completedAt: new Date(),
          retentionHoldReason: input.retentionHoldReason,
        },
      });
      return tx.deletionRequest.findFirst({ where: { id } });
    });
  }
}
