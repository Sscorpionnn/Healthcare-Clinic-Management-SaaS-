import { Module } from "@nestjs/common";
import { DoctorsController } from "./doctors.controller";
import { DoctorsService } from "./doctors.service";
import { DoctorSelfOrAdminPolicy } from "./doctors.policy";

@Module({
  controllers: [DoctorsController],
  providers: [DoctorsService, DoctorSelfOrAdminPolicy],
})
export class DoctorsModule {}
