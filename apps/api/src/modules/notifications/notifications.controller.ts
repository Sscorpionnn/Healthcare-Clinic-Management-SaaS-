import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SkipAudit } from "../../common/decorators/audit-resource.decorator";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import type { PaginationQuery } from "../../common/utils/pagination";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@SkipAudit()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.notifications.list(tenant, user, query);
  }

  @Post(":id/read")
  markRead(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.markRead(tenant, id, user);
  }
}
