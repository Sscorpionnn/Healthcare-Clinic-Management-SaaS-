import { Module } from "@nestjs/common";
import { PatientsController } from "./patients.controller";
import { PatientsService } from "./patients.service";
import { PatientAccessPolicy } from "./patients.policy";

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, PatientAccessPolicy],
  exports: [PatientAccessPolicy],
})
export class PatientsModule {}
