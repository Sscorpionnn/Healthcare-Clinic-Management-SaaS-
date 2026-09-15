import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { PrismaService } from "../../common/prisma/prisma.service";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import {
  parsePagination,
  paginated,
  type PaginationQuery,
} from "../../common/utils/pagination";
import {
  NOTIFICATIONS_QUEUE,
  type NotificationJobData,
} from "../../queue/queue.constants";
import { NotificationsGateway } from "../../websocket/notifications.gateway";

interface CreateNotificationInput {
  recipientUserId: string;
  type: string;
  title: string; // generic only — never clinical content, see docs/privacy-model.md
  linkResourceType?: string;
  linkResourceId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue<NotificationJobData>,
  ) {}

  /** Called by other modules (e.g. appointments) to notify a clinic member — never exposed directly as a public write endpoint. */
  async create(tenant: TenantContext, input: CreateNotificationInput) {
    const notification = await this.prisma.runTenant(tenant, (tx) =>
      tx.notification.create({
        data: {
          clinicId: tenant.clinicId,
          recipientUserId: input.recipientUserId,
          channel: "IN_APP",
          type: input.type,
          title: input.title,
          linkResourceType: input.linkResourceType,
          linkResourceId: input.linkResourceId,
        },
      }),
    );

    this.gateway.emitNotification(tenant.clinicId, input.recipientUserId, {
      id: notification.id,
      title: notification.title,
      type: notification.type,
    });
    await this.queue.add("deliver", {
      notificationId: notification.id,
      clinicId: tenant.clinicId,
      recipientUserId: input.recipientUserId,
    });

    return notification;
  }

  async list(
    tenant: TenantContext,
    viewer: AuthenticatedUser,
    query: PaginationQuery,
  ) {
    const pagination = parsePagination(query);
    const where = { recipientUserId: viewer.sub };
    return this.prisma.runTenant(tenant, async (tx) => {
      const [data, total] = await Promise.all([
        tx.notification.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { createdAt: "desc" },
        }),
        tx.notification.count({ where }),
      ]);
      return paginated(data, total, pagination);
    });
  }

  async markRead(tenant: TenantContext, id: string, viewer: AuthenticatedUser) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.notification.updateMany({
        where: { id, recipientUserId: viewer.sub },
        data: { readAt: new Date() },
      });
      if (result.count === 0) throw new NotFoundException();
    });
  }
}
