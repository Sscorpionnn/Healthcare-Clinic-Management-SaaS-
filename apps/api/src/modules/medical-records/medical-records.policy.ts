import { Injectable } from "@nestjs/common";
import type {
  PolicyCheckContext,
  ResourcePolicy,
} from "../../common/types/policy";

/**
 * CLINIC_ADMIN: clinic-wide but logged as an elevated read (see
 * AuditInterceptor) — compliance access, not routine use. DOCTOR: only
 * records where they are the treating doctor. NURSE: clinic-wide (schema
 * has no per-nurse assignment relation — documented simplification).
 * PATIENT: only their own records.
 */
@Injectable()
export class MedicalRecordAccessPolicy implements ResourcePolicy {
  async check({ user, params, tx }: PolicyCheckContext): Promise<boolean> {
    if (["CLINIC_ADMIN", "NURSE"].includes(user.role ?? "")) return true;

    const record = await tx.medicalRecord.findFirst({
      where: { id: params.id },
    });
    if (!record) return false;

    if (user.role === "DOCTOR") {
      const doctor = await tx.doctorProfile.findFirst({
        where: { membershipId: user.membershipId },
      });
      return doctor?.id === record.doctorId;
    }
    if (user.role === "PATIENT") {
      const patient = await tx.patientProfile.findFirst({
        where: { userId: user.sub },
      });
      return patient?.id === record.patientId;
    }
    return false;
  }
}
