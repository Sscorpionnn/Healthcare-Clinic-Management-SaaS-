import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import {
  NOTIFICATIONS_QUEUE,
  type NotificationJobData,
} from "../../queue/queue.constants";

/**
 * Async delivery hook for a Notification already created and pushed over
 * WebSocket. A production deployment wires this to SMTP/push — kept as an
 * explicit hook rather than adding an email dependency this repo can't
 * actually exercise end-to-end without real credentials, consistent with
 * not making external calls that aren't load-bearing for the product.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.debug(
      `notification ${job.data.notificationId} queued for delivery to user ${job.data.recipientUserId}`,
    );
  }
}
