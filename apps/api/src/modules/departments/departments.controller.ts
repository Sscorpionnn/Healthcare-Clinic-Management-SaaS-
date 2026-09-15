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
  createDepartmentSchema,
  type CreateDepartmentInput,
} from "@clinic/shared";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/zod/zod-validation.pipe";
import type { TenantContext } from "../../common/types/auth.types";
import type { PaginationQuery } from "../../common/utils/pagination";
import { AuditResource } from "../../common/decorators/audit-resource.decorator";
import { DepartmentsService } from "./departments.service";

@Controller("departments")
@AuditResource("Department")
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Post()
  @Roles("CLINIC_ADMIN")
  @UsePipes(new ZodValidationPipe(createDepartmentSchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateDepartmentInput,
  ) {
    return this.departments.create(tenant, body);
  }

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PaginationQuery,
  ) {
    return this.departments.list(tenant, query);
  }

  @Get(":id")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.departments.get(tenant, id);
  }

  @Patch(":id")
  @Roles("CLINIC_ADMIN")
  @UsePipes(new ZodValidationPipe(createDepartmentSchema.partial()))
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: Partial<CreateDepartmentInput>,
  ) {
    return this.departments.update(tenant, id, body);
  }

  @Delete(":id")
  @Roles("CLINIC_ADMIN")
  remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.departments.remove(tenant, id);
  }
}
