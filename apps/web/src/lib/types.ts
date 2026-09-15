// Shapes returned by the API — see docs/api-contract.md. Kept local to the
// web app (not in @clinic/shared) because these are response DTOs, not the
// write-side Zod schemas the two apps validate against.

export type MembershipSummary = {
  membershipId: string;
  clinicId: string;
  clinicName: string;
  role: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  membership: MembershipSummary | null;
};

export type LoginResponse =
  | { requiresClinicSelection: true; memberships: MembershipSummary[] }
  | { requiresClinicSelection?: false; user: CurrentUser };

export type PatientDto = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
};

export type AppointmentStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AppointmentDto = {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  departmentId?: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  reason?: string | null;
};

export type DoctorDto = {
  id: string;
  name: string;
  specialty: string;
  departmentId?: string | null;
};

export type DepartmentDto = {
  id: string;
  name: string;
  description?: string | null;
};

export type DocumentCategory = "CLINICAL" | "BILLING" | "INTAKE" | "IDENTITY";
export type DocumentStatus =
  "PENDING" | "AVAILABLE" | "REJECTED" | "QUARANTINED" | "DELETED";

export type DocumentDto = {
  id: string;
  ownerPatientId: string;
  category: DocumentCategory;
  originalFilename: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
};

export type UploadIntentResponse = {
  documentId: string;
  uploadUrl: string;
};

export type InvoiceStatus =
  "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "VOID" | "OVERDUE";

export type InvoiceDto = {
  id: string;
  patientId: string;
  patientName: string;
  status: InvoiceStatus;
  currency: string;
  totalAmount: number;
  issuedAt?: string | null;
  dueAt?: string | null;
};

export type StaffDto = {
  membershipId: string;
  userId: string;
  email: string;
  role: string;
  status: string;
  departmentId?: string | null;
};

export type AuditLogEntryDto = {
  id: string;
  clinicId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
};

export type DataExportRequestDto = {
  id: string;
  status: "PENDING" | "PROCESSING" | "READY" | "EXPIRED" | "FAILED";
  subjectPatientId?: string | null;
  createdAt: string;
};

export type DeletionRequestDto = {
  id: string;
  subjectType: "PATIENT" | "CLINIC";
  subjectPatientId?: string | null;
  status:
    "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SCHEDULED" | "COMPLETED";
  retentionHoldReason?: string | null;
  createdAt: string;
};

export type ClinicDto = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  timezone: string;
  createdAt: string;
};
