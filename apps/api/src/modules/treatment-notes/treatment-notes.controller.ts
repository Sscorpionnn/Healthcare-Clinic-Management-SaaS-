import { Body, Controller, Get, Param, Post, UsePipes } from "@nestjs/common";
import { createTreatmentNoteSchema } from "@clinic/shared";
import { z } from "zod";
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
import { MedicalRecordAccessPolicy } from "../medical-records/medical-records.policy";
import { TreatmentNotesService } from "./treatment-notes.service";

const bodySchema = createTreatmentNoteSchema.omit({ medicalRecordId: true });
type Body_ = z.infer<typeof bodySchema>;

@Controller("medical-records/:id/notes")
@Roles("CLINIC_ADMIN", "DOCTOR", "NURSE", "PATIENT")
@CheckPolicy(MedicalRecordAccessPolicy)
@AuditResource("TreatmentNote")
export class TreatmentNotesController {
  constructor(private readonly notes: TreatmentNotesService) {}

  @Post()
  @Roles("DOCTOR")
  @UsePipes(new ZodValidationPipe(bodySchema))
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: Body_,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notes.create(tenant, id, body, user);
  }

  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.notes.list(tenant, id);
  }
}
