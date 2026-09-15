"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, type PaginatedResponse } from "@/lib/api-client";
import type { InvoiceDto } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<
  InvoiceDto["status"],
  "default" | "secondary" | "destructive" | "success"
> = {
  DRAFT: "secondary",
  ISSUED: "default",
  PAID: "success",
  PARTIALLY_PAID: "default",
  VOID: "secondary",
  OVERDUE: "destructive",
};

export default function BillingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () =>
      apiFetch<PaginatedResponse<InvoiceDto>>("/invoices", {
        query: { page: 1, pageSize: 50 },
      }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4}>Loading…</TableCell>
              </TableRow>
            )}
            {data?.data.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.patientName}</TableCell>
                <TableCell>
                  {invoice.currency} {invoice.totalAmount.toFixed(2)}
                </TableCell>
                <TableCell>
                  {invoice.dueAt
                    ? new Date(invoice.dueAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[invoice.status]}>
                    {invoice.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
