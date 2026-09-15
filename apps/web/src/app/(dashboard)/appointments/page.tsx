"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  cancelAppointmentSchema,
  createAppointmentSchema,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
} from "@clinic/shared/schemas/appointment";
import { can } from "@clinic/shared/rbac/permissions";
import { apiFetch, type PaginatedResponse } from "@/lib/api-client";
import type {
  AppointmentDto,
  AppointmentStatus,
  DoctorDto,
  PatientDto,
} from "@/lib/types";
import { useRole } from "@/components/dashboard/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const STATUS_VARIANT: Record<
  AppointmentStatus,
  "default" | "secondary" | "destructive" | "success"
> = {
  REQUESTED: "secondary",
  CONFIRMED: "default",
  CHECKED_IN: "default",
  COMPLETED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

export default function AppointmentsPage() {
  const role = useRole();
  const canCreate = role ? can(role, "appointment", "create") : false;
  const canManage = role ? can(role, "appointment", "update") : false;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: () =>
      apiFetch<PaginatedResponse<AppointmentDto>>("/appointments", {
        query: { page: 1, pageSize: 50 },
      }),
  });

  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/appointments/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Could not update appointment" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Appointments</h1>
        {canCreate && <BookAppointmentDialog />}
      </div>

      <div className="space-y-3">
        {isLoading && <p>Loading…</p>}
        {data?.data.length === 0 && (
          <p className="text-muted-foreground">No appointments scheduled.</p>
        )}
        {data?.data.map((appt) => (
          <Card key={appt.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <p className="font-medium">
                  {new Date(appt.startsAt).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {appt.patientName} · Dr. {appt.doctorName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[appt.status]}>
                  {appt.status}
                </Badge>
                {canManage && appt.status === "REQUESTED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      transition.mutate({ id: appt.id, action: "confirm" })
                    }
                  >
                    Confirm
                  </Button>
                )}
                {canManage && appt.status === "CONFIRMED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      transition.mutate({ id: appt.id, action: "check-in" })
                    }
                  >
                    Check in
                  </Button>
                )}
                {canManage && appt.status === "CHECKED_IN" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      transition.mutate({ id: appt.id, action: "complete" })
                    }
                  >
                    Complete
                  </Button>
                )}
                {canManage &&
                  !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(
                    appt.status,
                  ) && <CancelAppointmentDialog appointmentId={appt.id} />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BookAppointmentDialog() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: patients } = useQuery({
    queryKey: ["patients", "for-booking"],
    queryFn: () =>
      apiFetch<PaginatedResponse<PatientDto>>("/patients", {
        query: { page: 1, pageSize: 100 },
      }),
    enabled: open,
  });
  const { data: doctors } = useQuery({
    queryKey: ["doctors", "for-booking"],
    queryFn: () =>
      apiFetch<PaginatedResponse<DoctorDto>>("/doctors", {
        query: { page: 1, pageSize: 100 },
      }),
    enabled: open,
  });

  const form = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateAppointmentInput) =>
      apiFetch("/appointments", { method: "POST", body: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Appointment booked" });
      setOpen(false);
      form.reset();
    },
    onError: () =>
      toast({ variant: "destructive", title: "Could not book appointment" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Book appointment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book appointment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a patient" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patients?.data.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="doctorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doctor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a doctor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {doctors?.data.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.specialty})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        onChange={(e) =>
                          field.onChange(new Date(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        onChange={(e) =>
                          field.onChange(new Date(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional, non-clinical)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Booking…" : "Book"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CancelAppointmentDialog({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CancelAppointmentInput>({
    resolver: zodResolver(cancelAppointmentSchema),
    defaultValues: { cancelReason: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: CancelAppointmentInput) =>
      apiFetch(`/appointments/${appointmentId}/cancel`, {
        method: "POST",
        body: values,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Appointment cancelled" });
      setOpen(false);
    },
    onError: () =>
      toast({ variant: "destructive", title: "Could not cancel appointment" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel appointment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="cancelReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                disabled={mutation.isPending}
              >
                Confirm cancellation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
