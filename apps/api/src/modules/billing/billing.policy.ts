import { Injectable } from "@nestjs/common";
import type {
  PolicyCheckContext,
  ResourcePolicy,
} from "../../common/types/policy";

@Injectable()
export class InvoiceAccessPolicy implements ResourcePolicy {
  async check({ user, params, tx }: PolicyCheckContext): Promise<boolean> {
    if (["CLINIC_ADMIN", "BILLING_MANAGER"].includes(user.role ?? ""))
      return true;

    if (user.role === "PATIENT") {
      const invoice = await tx.invoice.findFirst({ where: { id: params.id } });
      if (!invoice) return false;
      const patient = await tx.patientProfile.findFirst({
        where: { userId: user.sub },
      });
      return patient?.id === invoice.patientId;
    }
    return false;
  }
}
