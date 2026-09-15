import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import {
  createPatientSchema,
  updatePatientSchema,
  type CreatePatientInput,
  type UpdatePatientInput,
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
import { PatientsService } from "./patients.service";
import { PatientAccessPolicy } from "./patients.policy";

@Controller("patients")
@Roles(
  "CLINIC_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "BILLING_MANAGER",
  "PATIENT",
)
@AuditResource("Patient")
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post()
  @Roles("CLINIC_ADMIN", "RECEPTIONIST")
  @UsePipes(new ZodValidationPipe(createPatientSchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreatePatientInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patients.create(tenant, body, user);
  }

  @Get()
  @Roles("CLINIC_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "BILLING_MANAGER")
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.patients.list(tenant, user, query);
  }

  @Get(":id")
  @CheckPolicy(PatientAccessPolicy)
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patients.get(tenant, id, user);
  }

  @Patch(":id")
  @Roles("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT")
  @CheckPolicy(PatientAccessPolicy)
  @UsePipes(new ZodValidationPipe(updatePatientSchema))
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: UpdatePatientInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patients.update(tenant, id, body, user);
  }

  @Delete(":id")
  @Roles("CLINIC_ADMIN")
  @CheckPolicy(PatientAccessPolicy)
  remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.patients.remove(tenant, id);
  }
}
