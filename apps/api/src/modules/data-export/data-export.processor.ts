import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { decryptField, decryptOptionalField } from "@clinic/database";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  DATA_EXPORT_QUEUE,
  type DataExportJobData,
} from "../../queue/queue.constants";

const EXPORT_TTL_DAYS = 7;

/**
 * Assembles a data-export bundle. Re-scopes to the request's own
 * clinic/subject at execution time (not just at request time) — see
 * docs/privacy-model.md and docs/threat-model.md T20.
 */
@Processor(DATA_EXPORT_QUEUE)
export class DataExportProcessor extends WorkerHost {
  private readonly logger = new Logger(DataExportProcessor.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
    const endpoint = `${config.get("STORAGE_USE_SSL") === "true" ? "https" : "http"}://${config.getOrThrow("STORAGE_ENDPOINT")}:${config.getOrThrow("STORAGE_PORT")}`;
    this.client = new S3Client({
      endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow("STORAGE_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow("STORAGE_SECRET_KEY"),
      },
    });
    this.bucket = config.getOrThrow("STORAGE_BUCKET_PRIVATE");
  }

  async process(job: Job<DataExportJobData>): Promise<void> {
    const { requestId, clinicId } = job.data;

    await this.prisma.runTenant({ clinicId }, async (tx) => {
      const request = await tx.dataExportRequest.findFirst({
        where: { id: requestId },
      });
      if (!request || request.status !== "PENDING") return;

      await tx.dataExportRequest.updateMany({
        where: { id: requestId },
        data: { status: "PROCESSING" },
      });

      const patientWhere = request.subjectPatientId
        ? { id: request.subjectPatientId }
        : {};
      const patients = await tx.patientProfile.findMany({
        where: { ...patientWhere, deletedAt: null },
      });

      const bundle = await Promise.all(
        patients.map(async (patient) => {
          const [appointments, records, documents, invoices] =
            await Promise.all([
              tx.appointment.findMany({ where: { patientId: patient.id } }),
              tx.medicalRecord.findMany({ where: { patientId: patient.id } }),
              tx.document.findMany({ where: { ownerPatientId: patient.id } }),
              tx.invoice.findMany({
                where: { patientId: patient.id },
                include: { lineItems: true, payments: true },
              }),
            ]);

          return {
            patient: {
              id: patient.id,
              firstName: decryptField(patient.firstName),
              lastName: decryptField(patient.lastName),
              dateOfBirth: decryptField(patient.dateOfBirth),
              phone: decryptOptionalField(patient.phone),
              email: decryptOptionalField(patient.email),
            },
            appointments,
            medicalRecords: records.map((r) => ({
              ...r,
              chiefComplaint: decryptOptionalField(r.chiefComplaint),
              diagnosisNotes: decryptOptionalField(r.diagnosisNotes),
            })),
            documents: documents.map((d) => ({
              id: d.id,
              category: d.category,
              originalFilename: d.originalFilename,
              createdAt: d.createdAt,
            })),
            invoices,
          };
        }),
      );

      const key = `exports/${clinicId}/${requestId}.json`;
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: JSON.stringify({
            generatedAt: new Date().toISOString(),
            bundle,
          }),
          ContentType: "application/json",
        }),
      );

      await tx.dataExportRequest.updateMany({
        where: { id: requestId },
        data: {
          status: "READY",
          downloadKey: key,
          expiresAt: new Date(
            Date.now() + EXPORT_TTL_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      });
    });

    this.logger.debug(`data export ${requestId} ready`);
  }
}
