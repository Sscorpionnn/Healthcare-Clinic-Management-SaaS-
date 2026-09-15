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

// This clinic-scoped log intentionally never contains clinical content —
// only who did what to which resource, when. See docs/privacy-model.md.
export default function AuditLogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () =>
      apiFetch<PaginatedResponse<AuditLogEntryDto>>("/audit-logs", {
        query: { page: 1, pageSize: 50 },
      }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>
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
                <TableCell>
                  {entry.actorEmail ?? "—"}{" "}
                  {entry.actorRole && `(${entry.actorRole})`}
                </TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell>
                  {entry.resourceType}
                  {entry.resourceId
                    ? ` · ${entry.resourceId.slice(0, 8)}…`
                    : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
