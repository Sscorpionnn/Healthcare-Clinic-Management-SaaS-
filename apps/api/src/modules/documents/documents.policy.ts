import { Injectable } from "@nestjs/common";
import type {
  PolicyCheckContext,
  ResourcePolicy,
} from "../../common/types/policy";

/**
 * DOCTOR: only documents of patients they have a care-team relationship
 * with. BILLING_MANAGER: only `category=BILLING` documents. PATIENT: only
 * their own. CLINIC_ADMIN/NURSE/RECEPTIONIST: clinic-wide (see
 * docs/rbac.md; a full deployment would further restrict RECEPTIONIST to
 * non-clinical categories at the response-projection layer).
 */
@Injectable()
export class DocumentAccessPolicy implements ResourcePolicy {
  async check({ user, params, tx }: PolicyCheckContext): Promise<boolean> {
    const document = await tx.document.findFirst({ where: { id: params.id } });
    if (!document) return false;

    if (["CLINIC_ADMIN", "NURSE", "RECEPTIONIST"].includes(user.role ?? ""))
      return true;

    if (user.role === "BILLING_MANAGER") return document.category === "BILLING";

    if (user.role === "DOCTOR") {
      const doctor = await tx.doctorProfile.findFirst({
        where: { membershipId: user.membershipId },
      });
      if (!doctor) return false;
      const [appt, record] = await Promise.all([
        tx.appointment.findFirst({
          where: { patientId: document.ownerPatientId, doctorId: doctor.id },
        }),
        tx.medicalRecord.findFirst({
          where: { patientId: document.ownerPatientId, doctorId: doctor.id },
        }),
      ]);
      return !!(appt || record);
    }

    if (user.role === "PATIENT") {
      const patient = await tx.patientProfile.findFirst({
        where: { userId: user.sub },
      });
      return patient?.id === document.ownerPatientId;
    }

    return false;
  }
}
