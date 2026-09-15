import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type { Redis } from "ioredis";

import { PrismaModule } from "./common/prisma/prisma.module";
import { RedisModule, REDIS_CLIENT } from "./redis/redis.module";
import { StorageModule } from "./storage/storage.module";
import { QueueModule } from "./queue/queue.module";
import { WebsocketModule } from "./websocket/websocket.module";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health/health.controller";

import { AuthGuard } from "./common/guards/auth.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { PolicyGuard } from "./common/guards/policy.guard";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { RedisThrottlerStorage } from "./common/throttler/redis-throttler-storage";

import { ClinicsModule } from "./modules/clinics/clinics.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { StaffModule } from "./modules/staff/staff.module";
import { DoctorsModule } from "./modules/doctors/doctors.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { MedicalRecordsModule } from "./modules/medical-records/medical-records.module";
import { TreatmentNotesModule } from "./modules/treatment-notes/treatment-notes.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { BillingModule } from "./modules/billing/billing.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";
import { DataExportModule } from "./modules/data-export/data-export.module";
import { DeletionRequestsModule } from "./modules/deletion-requests/deletion-requests.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [{ name: "default", ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    QueueModule,
    WebsocketModule,
    AuthModule,
    ClinicsModule,
    DepartmentsModule,
    StaffModule,
    DoctorsModule,
    AvailabilityModule,
    PatientsModule,
    AppointmentsModule,
    MedicalRecordsModule,
    TreatmentNotesModule,
    DocumentsModule,
    BillingModule,
    NotificationsModule,
    AuditLogModule,
    DataExportModule,
    DeletionRequestsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: each runs in sequence and all must pass.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
