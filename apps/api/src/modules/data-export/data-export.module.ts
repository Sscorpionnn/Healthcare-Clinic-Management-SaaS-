import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DATA_EXPORT_QUEUE } from "../../queue/queue.constants";
import { DataExportController } from "./data-export.controller";
import { DataExportService } from "./data-export.service";
import { DataExportProcessor } from "./data-export.processor";
import { DataExportAccessPolicy } from "./data-export.policy";

@Module({
  imports: [BullModule.registerQueue({ name: DATA_EXPORT_QUEUE })],
  controllers: [DataExportController],
  providers: [DataExportService, DataExportProcessor, DataExportAccessPolicy],
})
export class DataExportModule {}
