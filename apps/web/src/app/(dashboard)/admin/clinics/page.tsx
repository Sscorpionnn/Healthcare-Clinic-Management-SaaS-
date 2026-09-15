"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClinicSchema,
  type CreateClinicInput,
} from "@clinic/shared/schemas/clinic";
import { apiFetch, type PaginatedResponse } from "@/lib/api-client";
import type { ClinicDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function AdminClinicsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "clinics"],
    queryFn: () =>
      apiFetch<PaginatedResponse<ClinicDto>>("/admin/clinics", {
        query: { page: 1, pageSize: 100 },
      }),
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const suspend = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/clinics/${id}/suspend`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clinics"] });
      toast({ title: "Clinic suspended" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clinics</h1>
        <CreateClinicDialog />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4}>Loading…</TableCell>
              </TableRow>
            )}
            {data?.data.map((clinic) => (
              <TableRow key={clinic.id}>
                <TableCell>{clinic.name}</TableCell>
                <TableCell>{clinic.slug}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      clinic.status === "ACTIVE" ? "success" : "secondary"
                    }
                  >
                    {clinic.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {clinic.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => suspend.mutate(clinic.id)}
                    >
                      Suspend
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CreateClinicDialog() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateClinicInput>({
    resolver: zodResolver(createClinicSchema),
    defaultValues: { name: "", slug: "", timezone: "UTC", adminEmail: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateClinicInput) =>
      apiFetch("/admin/clinics", { method: "POST", body: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clinics"] });
      toast({ title: "Clinic created" });
      setOpen(false);
      form.reset();
    },
    onError: () =>
      toast({ variant: "destructive", title: "Could not create clinic" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New clinic</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create clinic</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinic name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adminEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinic admin email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
