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
  createClinicSchema,
  suspendClinicSchema,
  updateClinicSchema,
  type CreateClinicInput,
  type SuspendClinicInput,
  type UpdateClinicInput,
} from "@clinic/shared";
import { PlatformRoute } from "../../common/decorators/platform-route.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/auth.types";
import type { PaginationQuery } from "../../common/utils/pagination";
import { ClinicsService } from "./clinics.service";

@Controller("admin/clinics")
@PlatformRoute()
@Roles("SUPER_ADMIN")
export class ClinicsController {
  constructor(private readonly clinics: ClinicsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createClinicSchema))
  create(
    @Body() body: CreateClinicInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinics.create(body, user.sub);
  }

  @Get()
  list(@Query() query: PaginationQuery) {
    return this.clinics.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.clinics.get(id);
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(updateClinicSchema))
  update(
    @Param("id") id: string,
    @Body() body: UpdateClinicInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinics.update(id, body, user.sub);
  }

  @Post(":id/suspend")
  @UsePipes(new ZodValidationPipe(suspendClinicSchema))
  suspend(
    @Param("id") id: string,
    @Body() body: SuspendClinicInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinics.suspend(id, body.reason, user.sub);
  }
}
