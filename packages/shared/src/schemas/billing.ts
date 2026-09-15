import { z } from "zod";

export const invoiceLineItemSchema = z
  .object({
    description: z.string().trim().min(1).max(200),
    quantity: z.number().int().positive().max(1000),
    unitAmount: z.number().nonnegative().max(1_000_000),
  })
  .strict();

export const createInvoiceSchema = z
  .object({
    patientId: z.string().uuid(),
    appointmentId: z.string().uuid().optional(),
    currency: z.string().length(3).default("USD"),
    dueAt: z.coerce.date().optional(),
    lineItems: z.array(invoiceLineItemSchema).min(1).max(50),
  })
  .strict();
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const recordPaymentSchema = z
  .object({
    amount: z.number().positive().max(1_000_000),
    method: z.enum([
      "CASH",
      "CARD_ON_FILE_TOKEN",
      "BANK_TRANSFER",
      "INSURANCE",
    ]),
    reference: z.string().trim().max(200).optional(), // gateway reference only, never raw card data
  })
  .strict();
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
