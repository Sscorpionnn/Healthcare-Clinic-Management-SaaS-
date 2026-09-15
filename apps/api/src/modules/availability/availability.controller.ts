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
  availabilitySlotSchema,
  type AvailabilitySlotInput,
} from "@clinic/shared";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CheckPolicy } from "../../common/decorators/check-policy.decorator";
import { AuditResource } from "../../common/decorators/audit-resource.decorator";
import { ZodValidationPipe } from "../../common/zod/zod-validation.pipe";
import type { TenantContext } from "../../common/types/auth.types";
import { AvailabilityService } from "./availability.service";
import { DoctorOwnAvailabilityPolicy } from "./availability.policy";

@Controller("doctors/:doctorId/availability")
@AuditResource("AvailabilitySlot")
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Param("doctorId") doctorId: string,
  ) {
    return this.availability.list(tenant, doctorId);
  }

  @Get("available-slots")
  availableSlots(
    @CurrentTenant() tenant: TenantContext,
    @Param("doctorId") doctorId: string,
    @Query("date") date: string,
  ) {
    return this.availability.availableSlots(tenant, doctorId, date);
  }

  @Post()
  @Roles("CLINIC_ADMIN", "DOCTOR")
  @CheckPolicy(DoctorOwnAvailabilityPolicy)
  @UsePipes(new ZodValidationPipe(availabilitySlotSchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param("doctorId") doctorId: string,
    @Body() body: AvailabilitySlotInput,
  ) {
    return this.availability.create(tenant, doctorId, body);
  }

  @Delete(":slotId")
  @Roles("CLINIC_ADMIN", "DOCTOR")
  @CheckPolicy(DoctorOwnAvailabilityPolicy)
  remove(
    @CurrentTenant() tenant: TenantContext,
    @Param("doctorId") doctorId: string,
    @Param("slotId") slotId: string,
  ) {
    return this.availability.remove(tenant, doctorId, slotId);
  }
}
