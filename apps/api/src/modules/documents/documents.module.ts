import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DOCUMENT_SCAN_QUEUE } from "../../queue/queue.constants";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { DocumentAccessPolicy } from "./documents.policy";

@Module({
  imports: [BullModule.registerQueue({ name: DOCUMENT_SCAN_QUEUE })],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentAccessPolicy],
})
export class DocumentsModule {}
