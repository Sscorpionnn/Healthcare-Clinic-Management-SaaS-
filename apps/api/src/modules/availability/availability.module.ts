import { Module } from "@nestjs/common";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityService } from "./availability.service";
import { DoctorOwnAvailabilityPolicy } from "./availability.policy";

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, DoctorOwnAvailabilityPolicy],
})
export class AvailabilityModule {}
