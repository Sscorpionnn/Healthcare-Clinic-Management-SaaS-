import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import {
  createInvoiceSchema,
  recordPaymentSchema,
  type CreateInvoiceInput,
  type RecordPaymentInput,
} from "@clinic/shared";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CheckPolicy } from "../../common/decorators/check-policy.decorator";
import { AuditResource } from "../../common/decorators/audit-resource.decorator";
import { ZodValidationPipe } from "../../common/zod/zod-validation.pipe";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import type { PaginationQuery } from "../../common/utils/pagination";
import { BillingService } from "./billing.service";
import { InvoiceAccessPolicy } from "./billing.policy";

@Controller("invoices")
@Roles("CLINIC_ADMIN", "BILLING_MANAGER", "PATIENT")
@AuditResource("Invoice")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post()
  @Roles("BILLING_MANAGER")
  @UsePipes(new ZodValidationPipe(createInvoiceSchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateInvoiceInput,
  ) {
    return this.billing.create(tenant, body);
  }

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.billing.list(tenant, user, query);
  }

  @Get(":id")
  @CheckPolicy(InvoiceAccessPolicy)
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.billing.get(tenant, id);
  }

  @Post(":id/payments")
  @Roles("BILLING_MANAGER")
  @CheckPolicy(InvoiceAccessPolicy)
  @UsePipes(new ZodValidationPipe(recordPaymentSchema))
  recordPayment(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: RecordPaymentInput,
  ) {
    return this.billing.recordPayment(tenant, id, body);
  }
}
