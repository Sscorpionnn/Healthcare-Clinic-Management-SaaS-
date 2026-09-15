import { Module } from "@nestjs/common";
import {
  ClinicAuditLogController,
  PlatformAuditLogController,
} from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";

@Module({
  controllers: [ClinicAuditLogController, PlatformAuditLogController],
  providers: [AuditLogService],
})
export class AuditLogModule {}
