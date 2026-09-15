import { Controller, Get, Query } from "@nestjs/common";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PlatformRoute } from "../../common/decorators/platform-route.decorator";
import { SkipAudit } from "../../common/decorators/audit-resource.decorator";
import type { TenantContext } from "../../common/types/auth.types";
import type { PaginationQuery } from "../../common/utils/pagination";
import { AuditLogService } from "./audit-log.service";

@Controller("audit-logs")
@Roles("CLINIC_ADMIN")
@SkipAudit()
export class ClinicAuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ) {
    return this.auditLog.listForClinic(tenant, query);
  }
}

@Controller("admin/audit-logs")
@PlatformRoute()
@Roles("SUPER_ADMIN")
@SkipAudit()
export class PlatformAuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(@Query() query: PaginationQuery) {
    return this.auditLog.listForPlatform(query);
  }
}
