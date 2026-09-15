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
  createMedicalRecordSchema,
  finalizeMedicalRecordSchema,
  type CreateMedicalRecordInput,
  type FinalizeMedicalRecordInput,
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
import { MedicalRecordsService } from "./medical-records.service";
import { MedicalRecordAccessPolicy } from "./medical-records.policy";

@Controller("medical-records")
@Roles("CLINIC_ADMIN", "DOCTOR", "NURSE", "PATIENT")
@AuditResource("MedicalRecord")
export class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordsService) {}

  @Post()
  @Roles("DOCTOR")
  @UsePipes(new ZodValidationPipe(createMedicalRecordSchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateMedicalRecordInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.records.create(tenant, body, user);
  }

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & { patientId?: string },
  ) {
    return this.records.list(tenant, user, query);
  }

  @Get(":id")
  @CheckPolicy(MedicalRecordAccessPolicy)
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.records.get(tenant, id);
  }

  @Post(":id/finalize")
  @Roles("DOCTOR")
  @CheckPolicy(MedicalRecordAccessPolicy)
  @UsePipes(new ZodValidationPipe(finalizeMedicalRecordSchema))
  finalize(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: FinalizeMedicalRecordInput,
  ) {
    return this.records.finalize(tenant, id, body);
  }
}
