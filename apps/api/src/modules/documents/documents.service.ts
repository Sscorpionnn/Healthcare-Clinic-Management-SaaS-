import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  type CreateUploadIntentInput,
} from "@clinic/shared";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
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
import { StorageService } from "../../storage/storage.service";
import {
  DOCUMENT_SCAN_QUEUE,
  type DocumentScanJobData,
} from "../../queue/queue.constants";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(DOCUMENT_SCAN_QUEUE)
    private readonly scanQueue: Queue<DocumentScanJobData>,
  ) {}

  async createUploadIntent(
    tenant: TenantContext,
    input: CreateUploadIntentInput,
    viewer: AuthenticatedUser,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      let ownerPatientId = input.ownerPatientId;
      if (viewer.role === "PATIENT") {
        const own = await tx.patientProfile.findFirst({
          where: { userId: viewer.sub },
        });
        if (!own)
          throw new BadRequestException(
            "No patient profile linked to this account",
          );
        ownerPatientId = own.id;
      } else {
        const patient = await tx.patientProfile.findFirst({
          where: { id: ownerPatientId, deletedAt: null },
        });
        if (!patient) throw new NotFoundException("Patient not found");
      }

      const storageKey = this.storage.generateObjectKey(tenant.clinicId);
      const document = await tx.document.create({
        data: {
          clinicId: tenant.clinicId,
          ownerPatientId,
          medicalRecordId: input.medicalRecordId,
          uploadedByMembershipId: viewer.membershipId!,
          category: input.category,
          originalFilename: input.filename,
          declaredMimeType: input.declaredMimeType,
          sizeBytes: input.sizeBytes,
          storageKey,
          status: "PENDING",
        },
      });

      const uploadUrl = await this.storage.presignQuarantineUploadUrl(
        storageKey,
        input.declaredMimeType,
      );
      return { documentId: document.id, uploadUrl };
    });
  }

  async complete(tenant: TenantContext, documentId: string) {
    const document = await this.prisma.runTenant(tenant, (tx) =>
      tx.document.findFirst({ where: { id: documentId } }),
    );
    if (!document) throw new NotFoundException();
    if (document.status !== "PENDING")
      throw new ConflictException(
        "Document is not pending upload verification",
      );

    const buffer = await this.storage.downloadQuarantineObject(
      document.storageKey,
    );

    // `file-type` ships ESM-only; dynamic import works from this
    // CommonJS-compiled service without forcing the whole API to ESM.
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(buffer);
    const sizeOk =
      buffer.length > 0 && buffer.length <= MAX_DOCUMENT_SIZE_BYTES;
    const mimeOk =
      !!detected &&
      (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(
        detected.mime,
      ) &&
      detected.mime === document.declaredMimeType;

    if (!sizeOk || !mimeOk) {
      await this.storage.deleteFromQuarantine(document.storageKey);
      await this.prisma.runTenant(tenant, (tx) =>
        tx.document.updateMany({
          where: { id: documentId },
          data: {
            status: "REJECTED",
            rejectionReason: !sizeOk
              ? "Size validation failed"
              : "File content does not match declared type",
            detectedMimeType: detected?.mime,
          },
        }),
      );
      throw new BadRequestException(
        "Uploaded file failed validation and was rejected",
      );
    }

    await this.storage.promoteToPrivate(document.storageKey);

    const checksum = createHash("sha256").update(buffer).digest("hex");
    await this.prisma.runTenant(tenant, (tx) =>
      tx.document.updateMany({
        where: { id: documentId },
        data: {
          status: "AVAILABLE",
          detectedMimeType: detected.mime,
          sizeBytes: buffer.length,
          checksumSha256: checksum,
        },
      }),
    );

    await this.scanQueue.add("scan", {
      documentId,
      clinicId: tenant.clinicId,
      quarantineKey: document.storageKey,
    });

    return this.prisma.runTenant(tenant, (tx) =>
      tx.document.findFirst({ where: { id: documentId } }),
    );
  }

  async getDownloadUrl(tenant: TenantContext, documentId: string) {
    const document = await this.prisma.runTenant(tenant, (tx) =>
      tx.document.findFirst({ where: { id: documentId } }),
    );
    if (!document || document.status !== "AVAILABLE")
      throw new NotFoundException();
    const url = await this.storage.presignPrivateDownloadUrl(
      document.storageKey,
    );
    return { url };
  }

  async list(
    tenant: TenantContext,
    viewer: AuthenticatedUser,
    query: PaginationQuery & { ownerPatientId?: string },
  ) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      let where: Record<string, unknown> = query.ownerPatientId
        ? { ownerPatientId: query.ownerPatientId }
        : {};
      if (viewer.role === "PATIENT") {
        const own = await tx.patientProfile.findFirst({
          where: { userId: viewer.sub },
        });
        where = { ...where, ownerPatientId: own?.id ?? "__none__" };
      } else if (viewer.role === "BILLING_MANAGER") {
        where = { ...where, category: "BILLING" };
      }
      const [data, total] = await Promise.all([
        tx.document.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { createdAt: "desc" },
        }),
        tx.document.count({ where }),
      ]);
      return paginated(data, total, pagination);
    });
  }

  async remove(tenant: TenantContext, documentId: string) {
    const document = await this.prisma.runTenant(tenant, (tx) =>
      tx.document.findFirst({ where: { id: documentId } }),
    );
    if (!document) throw new NotFoundException();

    if (document.status === "AVAILABLE")
      await this.storage.deleteFromPrivate(document.storageKey);
    if (document.status === "PENDING")
      await this.storage.deleteFromQuarantine(document.storageKey);

    await this.prisma.runTenant(tenant, (tx) =>
      tx.document.updateMany({
        where: { id: documentId },
        data: { status: "DELETED" },
      }),
    );
  }
}
