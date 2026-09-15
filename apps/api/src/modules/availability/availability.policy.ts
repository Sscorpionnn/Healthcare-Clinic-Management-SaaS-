import { Injectable } from "@nestjs/common";
import type {
  PolicyCheckContext,
  ResourcePolicy,
} from "../../common/types/policy";

/** A DOCTOR may only manage their own availability; CLINIC_ADMIN may manage any doctor's. */
@Injectable()
export class DoctorOwnAvailabilityPolicy implements ResourcePolicy {
  async check({ user, params, tx }: PolicyCheckContext): Promise<boolean> {
    if (user.role === "CLINIC_ADMIN") return true;
    if (user.role !== "DOCTOR") return false;
    const doctor = await tx.doctorProfile.findFirst({
      where: { id: params.doctorId },
    });
    return doctor?.membershipId === user.membershipId;
  }
}
