import { Injectable } from "@nestjs/common";
import type {
  PolicyCheckContext,
  ResourcePolicy,
} from "../../common/types/policy";

@Injectable()
export class DeletionRequestAccessPolicy implements ResourcePolicy {
  async check({ user, params, tx }: PolicyCheckContext): Promise<boolean> {
    if (user.role === "CLINIC_ADMIN") return true;
    const request = await tx.deletionRequest.findFirst({
      where: { id: params.id },
    });
    if (!request) return false;
    return request.requestedByUserId === user.sub;
  }
}
