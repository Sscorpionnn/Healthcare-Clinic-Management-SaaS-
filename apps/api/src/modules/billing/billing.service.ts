import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateInvoiceInput, RecordPaymentInput } from "@clinic/shared";
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

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenant: TenantContext, input: CreateInvoiceInput) {
    const totalAmount = input.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitAmount,
      0,
    );
    return this.prisma.runTenant(tenant, async (tx) => {
      const patient = await tx.patientProfile.findFirst({
        where: { id: input.patientId, deletedAt: null },
      });
      if (!patient) throw new NotFoundException("Patient not found");

      return tx.invoice.create({
        data: {
          clinicId: tenant.clinicId,
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          currency: input.currency,
          totalAmount,
          status: "ISSUED",
          issuedAt: new Date(),
          dueAt: input.dueAt,
          lineItems: {
            create: input.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitAmount: item.unitAmount,
              amount: item.quantity * item.unitAmount,
            })),
          },
        },
        include: { lineItems: true },
      });
    });
  }

  async list(
    tenant: TenantContext,
    viewer: AuthenticatedUser,
    query: PaginationQuery,
  ) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      let where: Record<string, unknown> = {};
      if (viewer.role === "PATIENT") {
        const patient = await tx.patientProfile.findFirst({
          where: { userId: viewer.sub },
        });
        where = { patientId: patient?.id ?? "__none__" };
      }
      const [data, total] = await Promise.all([
        tx.invoice.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { createdAt: "desc" },
          include: { lineItems: true, payments: true },
        }),
        tx.invoice.count({ where }),
      ]);
      return paginated(data, total, pagination);
    });
  }

  async get(tenant: TenantContext, id: string) {
    const invoice = await this.prisma.runTenant(tenant, (tx) =>
      tx.invoice.findFirst({
        where: { id },
        include: { lineItems: true, payments: true },
      }),
    );
    if (!invoice) throw new NotFoundException();
    return invoice;
  }

  async recordPayment(
    tenant: TenantContext,
    invoiceId: string,
    input: RecordPaymentInput,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId },
        include: { payments: true },
      });
      if (!invoice) throw new NotFoundException();

      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
        },
      });

      const totalPaid =
        invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) +
        input.amount;
      const newStatus =
        totalPaid >= Number(invoice.totalAmount) ? "PAID" : "PARTIALLY_PAID";
      await tx.invoice.updateMany({
        where: { id: invoiceId },
        data: { status: newStatus },
      });

      return payment;
    });
  }
}
