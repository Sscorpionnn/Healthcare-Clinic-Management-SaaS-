import { Module } from "@nestjs/common";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { AppointmentAccessPolicy } from "./appointments.policy";

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentAccessPolicy],
})
export class AppointmentsModule {}
