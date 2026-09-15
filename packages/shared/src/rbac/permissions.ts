import type { Role } from "./roles";

export const RESOURCES = [
  "clinic",
  "department",
  "staff",
  "doctor",
  "patient",
  "appointment",
  "availability",
  "medicalRecord",
  "treatmentNote",
  "document",
  "billing",
  "notification",
  "auditLog",
  "dataExport",
  "deletionRequest",
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ["create", "read", "update", "delete", "list"] as const;
export type Action = (typeof ACTIONS)[number];

const ALL_ACTIONS: Action[] = [...ACTIONS];

/**
 * Coarse role -> resource -> action permission matrix. This governs
 * `RolesGuard` (can this role ever perform this action on this resource
 * category) and drives UI affordance hiding on the frontend. It is
 * deliberately coarse: row-level ownership (e.g. "only the assigned
 * doctor", "only your own patients") is enforced separately by
 * `PolicyGuard` in the API — see docs/rbac.md. A `true` here is necessary
 * but not sufficient for access.
 */
export const PERMISSION_MATRIX: Record<
  Resource,
  Partial<Record<Role, Action[]>>
> = {
  clinic: {
    SUPER_ADMIN: ALL_ACTIONS,
    CLINIC_ADMIN: ["read", "update"],
  },
  department: {
    CLINIC_ADMIN: ALL_ACTIONS,
    DOCTOR: ["read", "list"],
    NURSE: ["read", "list"],
    RECEPTIONIST: ["read", "list"],
    BILLING_MANAGER: ["read", "list"],
  },
  staff: {
    CLINIC_ADMIN: ALL_ACTIONS,
  },
  doctor: {
    CLINIC_ADMIN: ALL_ACTIONS,
    DOCTOR: ["read", "update", "list"],
    NURSE: ["read", "list"],
    RECEPTIONIST: ["read", "list"],
    PATIENT: ["read", "list"],
  },
  patient: {
    CLINIC_ADMIN: ALL_ACTIONS,
    DOCTOR: ["read", "update", "list"],
    NURSE: ["read", "list"],
    RECEPTIONIST: ["create", "read", "update", "list"],
    BILLING_MANAGER: ["read", "list"],
    PATIENT: ["read", "update"],
  },
  appointment: {
    CLINIC_ADMIN: ALL_ACTIONS,
    DOCTOR: ["read", "update", "list"],
    NURSE: ["read", "list"],
    RECEPTIONIST: ALL_ACTIONS,
    PATIENT: ["create", "read", "update", "list"],
  },
  availability: {
    CLINIC_ADMIN: ALL_ACTIONS,
    DOCTOR: ALL_ACTIONS,
    RECEPTIONIST: ["read", "list"],
    PATIENT: ["read", "list"],
  },
  medicalRecord: {
    CLINIC_ADMIN: ["read", "list"],
    DOCTOR: ALL_ACTIONS,
    NURSE: ["read", "update", "list"],
    PATIENT: ["read", "list"],
  },
  treatmentNote: {
    DOCTOR: ALL_ACTIONS,
    NURSE: ["read", "list"],
    PATIENT: ["read", "list"],
  },
  document: {
    CLINIC_ADMIN: ["read", "update", "delete", "list"],
    DOCTOR: ALL_ACTIONS,
    NURSE: ["read", "list"],
    RECEPTIONIST: ["create", "read", "list"],
    BILLING_MANAGER: ["read", "list"],
    PATIENT: ["create", "read", "update", "delete", "list"],
  },
  billing: {
    BILLING_MANAGER: ALL_ACTIONS,
    CLINIC_ADMIN: ["read", "list"],
    PATIENT: ["read", "list"],
  },
  notification: {
    CLINIC_ADMIN: ["create", "read", "list"],
    DOCTOR: ["create", "read", "list"],
    RECEPTIONIST: ["create", "read", "list"],
    BILLING_MANAGER: ["create", "read", "list"],
    NURSE: ["read", "list"],
    PATIENT: ["read", "list"],
  },
  auditLog: {
    SUPER_ADMIN: ["read", "list"],
    CLINIC_ADMIN: ["read", "list"],
  },
  dataExport: {
    CLINIC_ADMIN: ["create", "read", "list"],
    PATIENT: ["create", "read", "list"],
  },
  deletionRequest: {
    CLINIC_ADMIN: ALL_ACTIONS,
    PATIENT: ["create", "read", "list"],
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  return PERMISSION_MATRIX[resource][role]?.includes(action) ?? false;
}
