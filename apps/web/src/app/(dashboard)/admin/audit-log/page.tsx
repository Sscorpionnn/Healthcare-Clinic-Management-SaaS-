"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, type PaginatedResponse } from "@/lib/api-client";
import type { AuditLogEntryDto } from "@/lib/types";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Platform-level audit log — metadata only, never clinical content, and
// never scoped to a single clinic's operational detail. See
// docs/privacy-model.md.
export default function PlatformAuditLogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-log"],
    queryFn: () =>
      apiFetch<PaginatedResponse<AuditLogEntryDto>>("/admin/audit-logs", {
        query: { page: 1, pageSize: 50 },
      }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Platform audit log</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4}>Loading…</TableCell>
              </TableRow>
            )}
            {data?.data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {new Date(entry.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>{entry.actorEmail ?? "—"}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell>{entry.resourceType}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
