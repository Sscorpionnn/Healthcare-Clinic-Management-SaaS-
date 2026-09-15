import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import {
  DOCUMENT_SCAN_QUEUE,
  type DocumentScanJobData,
} from "./queue.constants";

/**
 * Hook point for an antivirus scan between "uploaded to quarantine" and
 * "promoted to the private bucket" — see docs/document-security.md,
 * Malware/abuse mitigation. No specific AV engine is bundled in this repo;
 * wiring one in (e.g. ClamAV over its TCP protocol) means implementing
 * `scan()` below and is a config change, not a redesign — the queue,
 * job shape, and call site in the documents module are already in place.
 * Until an engine is configured, this processor is intentionally inert: it
 * does not report AV_CLEAN, so the documents module does not depend on it
 * for the promote decision (magic-byte + MIME + size validation, which the
 * documents module runs synchronously, is the real gate today).
 */
@Processor(DOCUMENT_SCAN_QUEUE)
export class DocumentScanProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentScanProcessor.name);

  async process(job: Job<DocumentScanJobData>): Promise<{ scanned: boolean }> {
    this.logger.debug(
      `document-scan hook received job for document ${job.data.documentId} (no AV engine configured)`,
    );
    return this.scan(job.data);
  }

  private async scan(
    _data: DocumentScanJobData,
  ): Promise<{ scanned: boolean }> {
    return { scanned: false };
  }
}
