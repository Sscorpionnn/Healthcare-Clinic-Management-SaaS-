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
  cancelAppointmentSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type RescheduleAppointmentInput,
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
import { AppointmentsService } from "./appointments.service";
import { AppointmentAccessPolicy } from "./appointments.policy";

@Controller("appointments")
@Roles("CLINIC_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "PATIENT")
@AuditResource("Appointment")
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @Roles("CLINIC_ADMIN", "RECEPTIONIST", "PATIENT")
  @UsePipes(new ZodValidationPipe(createAppointmentSchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateAppointmentInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointments.create(tenant, body, user);
  }

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.appointments.list(tenant, user, query);
  }

  @Get(":id")
  @CheckPolicy(AppointmentAccessPolicy)
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.appointments.get(tenant, id);
  }

  @Post(":id/confirm")
  @Roles("CLINIC_ADMIN", "RECEPTIONIST", "DOCTOR")
  @CheckPolicy(AppointmentAccessPolicy)
  confirm(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.appointments.confirm(tenant, id);
  }

  @Post(":id/check-in")
  @Roles("CLINIC_ADMIN", "RECEPTIONIST")
  @CheckPolicy(AppointmentAccessPolicy)
  checkIn(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.appointments.checkIn(tenant, id);
  }

  @Post(":id/complete")
  @Roles("CLINIC_ADMIN", "DOCTOR")
  @CheckPolicy(AppointmentAccessPolicy)
  complete(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.appointments.complete(tenant, id);
  }

  @Post(":id/no-show")
  @Roles("CLINIC_ADMIN", "RECEPTIONIST")
  @CheckPolicy(AppointmentAccessPolicy)
  noShow(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.appointments.markNoShow(tenant, id);
  }

  @Post(":id/cancel")
  @CheckPolicy(AppointmentAccessPolicy)
  @UsePipes(new ZodValidationPipe(cancelAppointmentSchema))
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: CancelAppointmentInput,
  ) {
    return this.appointments.cancel(tenant, id, body.cancelReason);
  }

  @Patch(":id/reschedule")
  @Roles("CLINIC_ADMIN", "RECEPTIONIST", "DOCTOR", "PATIENT")
  @CheckPolicy(AppointmentAccessPolicy)
  @UsePipes(new ZodValidationPipe(rescheduleAppointmentSchema))
  reschedule(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: RescheduleAppointmentInput,
  ) {
    return this.appointments.reschedule(tenant, id, body);
  }
}
