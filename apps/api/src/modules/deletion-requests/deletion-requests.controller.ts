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
  createDeletionRequestSchema,
  reviewDeletionRequestSchema,
  type CreateDeletionRequestInput,
  type ReviewDeletionRequestInput,
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
import { DeletionRequestsService } from "./deletion-requests.service";
import { DeletionRequestAccessPolicy } from "./deletion-requests.policy";

@Controller("deletion-requests")
@Roles("CLINIC_ADMIN", "PATIENT")
@AuditResource("DeletionRequest")
export class DeletionRequestsController {
  constructor(private readonly deletionRequests: DeletionRequestsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createDeletionRequestSchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateDeletionRequestInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deletionRequests.create(tenant, body, user);
  }

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.deletionRequests.list(tenant, user, query);
  }

  @Post(":id/review")
  @Roles("CLINIC_ADMIN")
  @CheckPolicy(DeletionRequestAccessPolicy)
  @UsePipes(new ZodValidationPipe(reviewDeletionRequestSchema))
  review(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: ReviewDeletionRequestInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deletionRequests.review(tenant, id, body, user.sub);
  }
}
