import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CheckPolicy } from "../../common/decorators/check-policy.decorator";
import { AuditResource } from "../../common/decorators/audit-resource.decorator";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import type { PaginationQuery } from "../../common/utils/pagination";
import { DoctorsService } from "./doctors.service";
import { DoctorSelfOrAdminPolicy } from "./doctors.policy";

@Controller("doctors")
@AuditResource("DoctorProfile")
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.doctors.list(tenant, user, query);
  }

  @Get(":id")
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctors.get(tenant, id, user);
  }

  @Patch(":id")
  @Roles("CLINIC_ADMIN", "DOCTOR")
  @CheckPolicy(DoctorSelfOrAdminPolicy)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: { specialty?: string; bio?: string },
  ) {
    return this.doctors.update(tenant, id, body);
  }
}
