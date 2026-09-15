import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { decryptField, encryptField } from "@clinic/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";

interface CreateTreatmentNoteBody {
  noteType: string;
  content: string;
}

function view<T extends { content: string }>(note: T) {
  return { ...note, content: decryptField(note.content) };
}

@Injectable()
export class TreatmentNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenant: TenantContext,
    medicalRecordId: string,
    input: CreateTreatmentNoteBody,
    viewer: AuthenticatedUser,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const record = await tx.medicalRecord.findFirst({
        where: { id: medicalRecordId },
      });
      if (!record) throw new NotFoundException();

      const doctor = await tx.doctorProfile.findFirst({
        where: { membershipId: viewer.membershipId },
      });
      if (!doctor || doctor.id !== record.doctorId) {
        throw new BadRequestException(
          "Only the treating doctor can add a note to this record",
        );
      }

      const note = await tx.treatmentNote.create({
        data: {
          clinicId: tenant.clinicId,
          medicalRecordId,
          authorMembershipId: viewer.membershipId!,
          noteType: input.noteType,
          content: encryptField(input.content),
        },
      });
      return view(note);
    });
  }

  async list(tenant: TenantContext, medicalRecordId: string) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const record = await tx.medicalRecord.findFirst({
        where: { id: medicalRecordId },
      });
      if (!record) throw new NotFoundException();
      const notes = await tx.treatmentNote.findMany({
        where: { medicalRecordId },
        orderBy: { createdAt: "desc" },
      });
      return notes.map(view);
    });
  }
}
