import { Injectable } from "@nestjs/common";
import type {
  PolicyCheckContext,
  ResourcePolicy,
} from "../../common/types/policy";

/** DOCTOR: only their own appointments. PATIENT: only their own. Others: clinic-wide. */
@Injectable()
export class AppointmentAccessPolicy implements ResourcePolicy {
  async check({ user, params, tx }: PolicyCheckContext): Promise<boolean> {
    if (["CLINIC_ADMIN", "RECEPTIONIST", "NURSE"].includes(user.role ?? ""))
      return true;

    const appointment = await tx.appointment.findFirst({
      where: { id: params.id },
    });
    if (!appointment) return false;

    if (user.role === "DOCTOR") {
      const doctor = await tx.doctorProfile.findFirst({
        where: { membershipId: user.membershipId },
      });
      return doctor?.id === appointment.doctorId;
    }
    if (user.role === "PATIENT") {
      const patient = await tx.patientProfile.findFirst({
        where: { userId: user.sub },
      });
      return patient?.id === appointment.patientId;
    }
    return false;
  }
}
