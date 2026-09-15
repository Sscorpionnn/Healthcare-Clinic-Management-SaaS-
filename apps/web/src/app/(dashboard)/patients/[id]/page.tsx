"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type PaginatedResponse } from "@/lib/api-client";
import type { AppointmentDto, DocumentDto, PatientDto } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/components/dashboard/session-provider";
import { can } from "@clinic/shared/rbac/permissions";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useRole();

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patients", id],
    queryFn: () => apiFetch<PatientDto>(`/patients/${id}`),
  });

  const { data: appointments } = useQuery({
    queryKey: ["patients", id, "appointments"],
    queryFn: () =>
      apiFetch<PaginatedResponse<AppointmentDto>>("/appointments", {
        query: { patientId: id },
      }),
  });

  const { data: documents } = useQuery({
    queryKey: ["patients", id, "documents"],
    queryFn: () =>
      apiFetch<PaginatedResponse<DocumentDto>>("/documents", {
        query: { ownerPatientId: id },
      }),
  });

  if (isLoading) return <p>Loading…</p>;
  if (!patient) return <p>Patient not found.</p>;

  const canSeeRecords = role
    ? can(role, "medicalRecord", "read") || can(role, "medicalRecord", "list")
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {patient.firstName} {patient.lastName}
        </h1>
        <p className="text-muted-foreground">Born {patient.dateOfBirth}</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Phone: {patient.phone ?? "—"}</p>
              <p>Email: {patient.email ?? "—"}</p>
              {canSeeRecords && (
                <Link
                  href={`/patients/${id}/medical-records`}
                  className="inline-block pt-2"
                >
                  <Button variant="outline">View medical records</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {appointments?.data.length === 0 && (
                <p className="text-muted-foreground">No appointments.</p>
              )}
              {appointments?.data.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(appt.startsAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Dr. {appt.doctorName}
                    </p>
                  </div>
                  <Badge
                    variant={
                      appt.status === "CANCELLED" ? "destructive" : "secondary"
                    }
                  >
                    {appt.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {documents?.data.length === 0 && (
                <p className="text-muted-foreground">No documents.</p>
              )}
              {documents?.data.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{doc.originalFilename}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.category}
                    </p>
                  </div>
                  <Badge
                    variant={
                      doc.status === "AVAILABLE" ? "success" : "secondary"
                    }
                  >
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
