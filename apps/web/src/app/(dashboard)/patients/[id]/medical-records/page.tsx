"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createMedicalRecordSchema,
  createTreatmentNoteSchema,
  type CreateMedicalRecordInput,
  type CreateTreatmentNoteInput,
} from "@clinic/shared/schemas/clinical";
import { can } from "@clinic/shared/rbac/permissions";
import { apiFetch, type PaginatedResponse } from "@/lib/api-client";
import { useRole } from "@/components/dashboard/session-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

type MedicalRecordDto = {
  id: string;
  visitDate: string;
  chiefComplaint?: string | null;
  diagnosisNotes?: string | null;
  status: "DRAFT" | "FINALIZED" | "AMENDED";
};

type TreatmentNoteDto = {
  id: string;
  noteType: string;
  content: string;
  createdAt: string;
};

export default function MedicalRecordsPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const role = useRole();
  const canWrite = role ? can(role, "medicalRecord", "create") : false;

  const { data, isLoading } = useQuery({
    queryKey: ["patients", patientId, "medical-records"],
    queryFn: () =>
      apiFetch<PaginatedResponse<MedicalRecordDto>>("/medical-records", {
        query: { patientId },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Medical records</h1>
        {canWrite && <NewRecordDialog patientId={patientId} />}
      </div>

      {isLoading && <p>Loading…</p>}
      {data?.data.length === 0 && (
        <p className="text-muted-foreground">No records yet.</p>
      )}

      <div className="space-y-4">
        {data?.data.map((record) => (
          <RecordCard key={record.id} record={record} canWrite={canWrite} />
        ))}
      </div>
    </div>
  );
}

function RecordCard({
  record,
  canWrite,
}: {
  record: MedicalRecordDto;
  canWrite: boolean;
}) {
  const { data: notes } = useQuery({
    queryKey: ["medical-records", record.id, "notes"],
    queryFn: () =>
      apiFetch<PaginatedResponse<TreatmentNoteDto>>(
        `/medical-records/${record.id}/notes`,
      ),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>
            {new Date(record.visitDate).toLocaleDateString()}
          </CardTitle>
        </div>
        <Badge
          variant={record.status === "FINALIZED" ? "success" : "secondary"}
        >
          {record.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {record.chiefComplaint && (
          <p className="text-sm">Chief complaint: {record.chiefComplaint}</p>
        )}
        {record.diagnosisNotes && (
          <p className="text-sm">Diagnosis: {record.diagnosisNotes}</p>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Treatment notes
          </h3>
          {notes?.data.map((note) => (
            <div key={note.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{note.noteType}</p>
              <p>{note.content}</p>
            </div>
          ))}
          {canWrite && <NewNoteDialog medicalRecordId={record.id} />}
        </div>
      </CardContent>
    </Card>
  );
}

function NewRecordDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateMedicalRecordInput>({
    resolver: zodResolver(createMedicalRecordSchema),
    defaultValues: { patientId, visitDate: new Date() },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateMedicalRecordInput) =>
      apiFetch("/medical-records", { method: "POST", body: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patients", patientId, "medical-records"],
      });
      toast({ title: "Record created" });
      setOpen(false);
    },
    onError: () =>
      toast({ variant: "destructive", title: "Could not create record" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New record</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New medical record</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="chiefComplaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chief complaint</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NewNoteDialog({ medicalRecordId }: { medicalRecordId: string }) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateTreatmentNoteInput>({
    resolver: zodResolver(createTreatmentNoteSchema),
    defaultValues: { medicalRecordId, noteType: "progress", content: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateTreatmentNoteInput) =>
      apiFetch(`/medical-records/${medicalRecordId}/notes`, {
        method: "POST",
        body: values,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["medical-records", medicalRecordId, "notes"],
      });
      toast({ title: "Note added" });
      setOpen(false);
      form.reset({ medicalRecordId, noteType: "progress", content: "" });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Could not add note" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Add note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New treatment note</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Save note
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
