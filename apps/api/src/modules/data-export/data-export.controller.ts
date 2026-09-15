import { Body, Controller, Get, Param, Post, UsePipes } from "@nestjs/common";
import {
  createDataExportRequestSchema,
  type CreateDataExportRequestInput,
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
import { DataExportService } from "./data-export.service";
import { DataExportAccessPolicy } from "./data-export.policy";

@Controller("data-export-requests")
@Roles("CLINIC_ADMIN", "PATIENT")
@AuditResource("DataExportRequest")
export class DataExportController {
  constructor(private readonly dataExport: DataExportService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createDataExportRequestSchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateDataExportRequestInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataExport.create(tenant, body, user);
  }

  @Get(":id")
  @CheckPolicy(DataExportAccessPolicy)
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.dataExport.get(tenant, id);
  }

  @Get(":id/download")
  @CheckPolicy(DataExportAccessPolicy)
  getDownload(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.dataExport.getDownloadUrl(tenant, id);
  }
}
