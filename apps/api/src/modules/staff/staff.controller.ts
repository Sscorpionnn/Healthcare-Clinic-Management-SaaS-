import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import {
  inviteStaffSchema,
  updateStaffRoleSchema,
  type InviteStaffInput,
  type UpdateStaffRoleInput,
} from "@clinic/shared";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuditResource } from "../../common/decorators/audit-resource.decorator";
import { ZodValidationPipe } from "../../common/zod/zod-validation.pipe";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import type { PaginationQuery } from "../../common/utils/pagination";
import { StaffService } from "./staff.service";

@Controller("staff")
@Roles("CLINIC_ADMIN")
@AuditResource("Membership")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ) {
    return this.staff.list(tenant, query);
  }

  @Post("invite")
  @UsePipes(new ZodValidationPipe(inviteStaffSchema))
  invite(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: InviteStaffInput,
  ) {
    return this.staff.invite(tenant, body);
  }

  @Patch(":membershipId/role")
  @UsePipes(new ZodValidationPipe(updateStaffRoleSchema))
  updateRole(
    @CurrentTenant() tenant: TenantContext,
    @Param("membershipId") membershipId: string,
    @Body() body: UpdateStaffRoleInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staff.updateRole(
      tenant,
      membershipId,
      body.role,
      user.membershipId,
    );
  }

  @Post(":membershipId/suspend")
  suspend(
    @CurrentTenant() tenant: TenantContext,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staff.suspend(tenant, membershipId, user.membershipId);
  }
}
