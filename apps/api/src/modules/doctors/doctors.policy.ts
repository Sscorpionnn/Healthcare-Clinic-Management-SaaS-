import { Injectable } from "@nestjs/common";
import type {
  PolicyCheckContext,
  ResourcePolicy,
} from "../../common/types/policy";

/** A DOCTOR may only modify their own profile; CLINIC_ADMIN may modify any. */
@Injectable()
export class DoctorSelfOrAdminPolicy implements ResourcePolicy {
  async check({ user, params, tx }: PolicyCheckContext): Promise<boolean> {
    if (user.role === "CLINIC_ADMIN") return true;
    if (user.role !== "DOCTOR") return false;
    const doctor = await tx.doctorProfile.findFirst({
      where: { id: params.id },
    });
    return doctor?.membershipId === user.membershipId;
  }
}
