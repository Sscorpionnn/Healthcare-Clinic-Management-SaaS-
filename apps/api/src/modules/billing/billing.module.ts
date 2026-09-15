import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { InvoiceAccessPolicy } from "./billing.policy";

@Module({
  controllers: [BillingController],
  providers: [BillingService, InvoiceAccessPolicy],
})
export class BillingModule {}
