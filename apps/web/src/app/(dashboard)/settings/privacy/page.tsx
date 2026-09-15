"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type PaginatedResponse } from "@/lib/api-client";
import type { DataExportRequestDto, DeletionRequestDto } from "@/lib/types";
import { useRole } from "@/components/dashboard/session-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function PrivacyPage() {
  const role = useRole();
  const isPatient = role === "PATIENT";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: exports } = useQuery({
    queryKey: ["data-export-requests"],
    queryFn: () =>
      apiFetch<PaginatedResponse<DataExportRequestDto>>(
        "/data-export-requests",
      ),
  });
  const { data: deletions } = useQuery({
    queryKey: ["deletion-requests"],
    queryFn: () =>
      apiFetch<PaginatedResponse<DeletionRequestDto>>("/deletion-requests"),
  });

  const requestExport = useMutation({
    mutationFn: () =>
      apiFetch("/data-export-requests", { method: "POST", body: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-export-requests"] });
      toast({
        title: "Export requested",
        description: "We'll notify you when it's ready to download.",
      });
    },
  });

  const requestDeletion = useMutation({
    mutationFn: () =>
      apiFetch("/deletion-requests", {
        method: "POST",
        body: isPatient
          ? { subjectType: "PATIENT" }
          : { subjectType: "CLINIC" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      toast({
        title: "Deletion requested",
        description: "A clinic administrator will review this request.",
      });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Privacy</h1>

      <Card>
        <CardHeader>
          <CardTitle>Data export</CardTitle>
          <CardDescription>
            {isPatient
              ? "Request a copy of your own records."
              : "Request an export of this clinic's data on behalf of a data subject."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => requestExport.mutate()}
            disabled={requestExport.isPending}
          >
            Request export
          </Button>
          <div className="space-y-2">
            {exports?.data.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span>{new Date(req.createdAt).toLocaleString()}</span>
                <Badge
                  variant={req.status === "READY" ? "success" : "secondary"}
                >
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deletion request</CardTitle>
          <CardDescription>
            {isPatient
              ? "Request erasure of your data. Clinical records under legal retention are anonymized rather than deleted outright — you'll be told which applies."
              : "Review and approve deletion requests for this clinic, respecting any retention holds."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPatient && (
            <Button
              variant="destructive"
              onClick={() => requestDeletion.mutate()}
              disabled={requestDeletion.isPending}
            >
              Request deletion
            </Button>
          )}
          <div className="space-y-2">
            {deletions?.data.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span>
                  {req.subjectType} · {new Date(req.createdAt).toLocaleString()}
                  {req.retentionHoldReason &&
                    ` · hold: ${req.retentionHoldReason}`}
                </span>
                <Badge
                  variant={req.status === "COMPLETED" ? "success" : "secondary"}
                >
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
