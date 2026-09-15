import { Injectable } from "@nestjs/common";
import type {
  PolicyCheckContext,
  ResourcePolicy,
} from "../../common/types/policy";

/**
 * Row-level ownership for a Patient by `:id` param — see docs/rbac.md.
 * CLINIC_ADMIN/RECEPTIONIST/BILLING_MANAGER/NURSE: clinic-wide (schema has
 * no explicit nurse-assignment relation to model finer granularity — a
 * documented simplification, see report). DOCTOR: only patients they have
 * an appointment or medical record with. PATIENT: only their own profile.
 */
@Injectable()
export class PatientAccessPolicy implements ResourcePolicy {
  async check({ user, params, tx }: PolicyCheckContext): Promise<boolean> {
    if (
      ["CLINIC_ADMIN", "RECEPTIONIST", "BILLING_MANAGER", "NURSE"].includes(
        user.role ?? "",
      )
    )
      return true;

    if (user.role === "PATIENT") {
      const patient = await tx.patientProfile.findFirst({
        where: { id: params.id, userId: user.sub },
      });
      return !!patient;
    }

    if (user.role === "DOCTOR") {
      const doctor = await tx.doctorProfile.findFirst({
        where: { membershipId: user.membershipId },
      });
      if (!doctor) return false;
      const [appointment, record] = await Promise.all([
        tx.appointment.findFirst({
          where: { patientId: params.id, doctorId: doctor.id },
        }),
        tx.medicalRecord.findFirst({
          where: { patientId: params.id, doctorId: doctor.id },
        }),
      ]);
      return !!(appointment || record);
    }

    return false;
  }
}
