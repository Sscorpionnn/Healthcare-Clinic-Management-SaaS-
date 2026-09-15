import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import {
  createUploadIntentSchema,
  type CreateUploadIntentInput,
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
import { DocumentsService } from "./documents.service";
import { DocumentAccessPolicy } from "./documents.policy";

@Controller("documents")
@Roles(
  "CLINIC_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "BILLING_MANAGER",
  "PATIENT",
)
@AuditResource("Document")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post("upload-intent")
  @Roles("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT")
  @UsePipes(new ZodValidationPipe(createUploadIntentSchema))
  createUploadIntent(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateUploadIntentInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.createUploadIntent(tenant, body, user);
  }

  @Post(":id/complete")
  @Roles("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT")
  @CheckPolicy(DocumentAccessPolicy)
  complete(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.documents.complete(tenant, id);
  }

  @Get(":id/download-url")
  @CheckPolicy(DocumentAccessPolicy)
  getDownloadUrl(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
  ) {
    return this.documents.getDownloadUrl(tenant, id);
  }

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & { ownerPatientId?: string },
  ) {
    return this.documents.list(tenant, user, query);
  }

  @Delete(":id")
  @Roles("CLINIC_ADMIN", "DOCTOR", "PATIENT")
  @CheckPolicy(DocumentAccessPolicy)
  remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.documents.remove(tenant, id);
  }
}
