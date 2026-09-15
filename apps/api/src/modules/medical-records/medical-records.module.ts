import { Module } from "@nestjs/common";
import { MedicalRecordsController } from "./medical-records.controller";
import { MedicalRecordsService } from "./medical-records.service";
import { MedicalRecordAccessPolicy } from "./medical-records.policy";

@Module({
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService, MedicalRecordAccessPolicy],
  exports: [MedicalRecordAccessPolicy],
})
export class MedicalRecordsModule {}
