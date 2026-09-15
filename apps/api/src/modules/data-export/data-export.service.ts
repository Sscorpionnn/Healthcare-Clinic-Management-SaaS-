import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { CreateDataExportRequestInput } from "@clinic/shared";
import { PrismaService } from "../../common/prisma/prisma.service";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import {
  DATA_EXPORT_QUEUE,
  type DataExportJobData,
} from "../../queue/queue.constants";
import { StorageService } from "../../storage/storage.service";

@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(DATA_EXPORT_QUEUE)
    private readonly queue: Queue<DataExportJobData>,
  ) {}

  async create(
    tenant: TenantContext,
    input: CreateDataExportRequestInput,
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
      // CLINIC_ADMIN may omit subjectPatientId for a clinic-wide export; any other role must be scoped to themselves (handled above).
      throw new ForbiddenException();
    }

    const request = await this.prisma.runTenant(tenant, (tx) =>
      tx.dataExportRequest.create({
        data: {
          clinicId: tenant.clinicId,
          requestedByUserId: viewer.sub,
          subjectPatientId,
          status: "PENDING",
        },
      }),
    );

    await this.queue.add("export", {
      requestId: request.id,
      clinicId: tenant.clinicId,
    });
    return request;
  }

  async get(tenant: TenantContext, id: string) {
    const request = await this.prisma.runTenant(tenant, (tx) =>
      tx.dataExportRequest.findFirst({ where: { id } }),
    );
    if (!request) throw new NotFoundException();
    return request;
  }

  async getDownloadUrl(tenant: TenantContext, id: string) {
    const request = await this.get(tenant, id);
    if (request.status !== "READY" || !request.downloadKey)
      throw new NotFoundException("Export is not ready");
    if (request.expiresAt && request.expiresAt < new Date())
      throw new NotFoundException("Export has expired");
    const url = await this.storage.presignPrivateDownloadUrl(
      request.downloadKey,
    );
    return { url };
  }
}
