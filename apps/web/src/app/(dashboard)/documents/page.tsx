"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@clinic/shared/schemas/document";
import { apiFetch, type PaginatedResponse } from "@/lib/api-client";
import type {
  DocumentCategory,
  DocumentDto,
  PatientDto,
  UploadIntentResponse,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(",");

export default function DocumentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () =>
      apiFetch<PaginatedResponse<DocumentDto>>("/documents", {
        query: { page: 1, pageSize: 50 },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <UploadDialog />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4}>Loading…</TableCell>
              </TableRow>
            )}
            {data?.data.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{doc.originalFilename}</TableCell>
                <TableCell>{doc.category}</TableCell>
                <TableCell>{(doc.sizeBytes / 1024).toFixed(0)} KB</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      doc.status === "AVAILABLE"
                        ? "success"
                        : doc.status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {doc.status}
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

function UploadDialog() {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [category, setCategory] = React.useState<DocumentCategory>("CLINICAL");
  const [ownerPatientId, setOwnerPatientId] = React.useState<string>("");
  const [clientError, setClientError] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: patients } = useQuery({
    queryKey: ["patients", "for-upload"],
    queryFn: () =>
      apiFetch<PaginatedResponse<PatientDto>>("/patients", {
        query: { page: 1, pageSize: 100 },
      }),
    enabled: open,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      // Client-side pre-checks mirror @clinic/shared's document schema for
      // fast feedback only — the server independently re-validates
      // extension, declared MIME, magic bytes, and size before ever
      // marking a document AVAILABLE (see docs/document-security.md). This
      // is UX, not the real control.
      const intent = await apiFetch<UploadIntentResponse>(
        "/documents/upload-intent",
        {
          method: "POST",
          body: {
            ownerPatientId,
            category,
            filename: file.name,
            declaredMimeType: file.type,
            sizeBytes: file.size,
          },
        },
      );

      const putResponse = await fetch(intent.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putResponse.ok) throw new Error("Upload to storage failed");

      await apiFetch(`/documents/${intent.documentId}/complete`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document uploaded" });
      setOpen(false);
      setFile(null);
    },
    onError: (error: unknown) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setClientError(null);
    if (selected) {
      if (
        !(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(
          selected.type,
        )
      ) {
        setClientError("File type not allowed. Use PDF, JPEG, or PNG.");
        setFile(null);
        return;
      }
      if (selected.size > MAX_DOCUMENT_SIZE_BYTES) {
        setClientError("File is too large (max 15 MB).");
        setFile(null);
        return;
      }
    }
    setFile(selected);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload document</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Patient</Label>
            <Select value={ownerPatientId} onValueChange={setOwnerPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients?.data.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as DocumentCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <Input type="file" accept={ACCEPT} onChange={handleFileChange} />
            {clientError && (
              <p className="text-sm text-destructive">{clientError}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!file || !ownerPatientId || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
