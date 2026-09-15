import { Module } from "@nestjs/common";
import { MedicalRecordsModule } from "../medical-records/medical-records.module";
import { TreatmentNotesController } from "./treatment-notes.controller";
import { TreatmentNotesService } from "./treatment-notes.service";

@Module({
  imports: [MedicalRecordsModule],
  controllers: [TreatmentNotesController],
  providers: [TreatmentNotesService],
})
export class TreatmentNotesModule {}
