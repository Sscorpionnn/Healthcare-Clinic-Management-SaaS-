import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  DATA_EXPORT_QUEUE,
  DOCUMENT_SCAN_QUEUE,
  NOTIFICATIONS_QUEUE,
} from "./queue.constants";
import { DocumentScanProcessor } from "./document-scan.processor";

/**
 * BullMQ queues for work that must not block the request/response cycle:
 * notification delivery, data-export bundle assembly, and the document
 * antivirus-scan hook point (docs/document-security.md). Individual
 * feature modules (documents, data-export) register their own processors
 * that need access to their services; this module owns the connection and
 * the queues that are cross-cutting (document-scan).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>("REDIS_URL") },
      }),
    }),
    BullModule.registerQueue(
      { name: NOTIFICATIONS_QUEUE },
      { name: DATA_EXPORT_QUEUE },
      { name: DOCUMENT_SCAN_QUEUE },
    ),
  ],
  providers: [DocumentScanProcessor],
  exports: [BullModule],
})
export class QueueModule {}
