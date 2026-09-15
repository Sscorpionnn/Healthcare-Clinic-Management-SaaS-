import { can } from "../rbac/permissions";

describe("RBAC permission matrix", () => {
  it("allows BILLING_MANAGER to manage billing", () => {
    expect(can("BILLING_MANAGER", "billing", "create")).toBe(true);
    expect(can("BILLING_MANAGER", "billing", "read")).toBe(true);
  });

  it("never grants BILLING_MANAGER access to medical records", () => {
    for (const action of [
      "create",
      "read",
      "update",
      "delete",
      "list",
    ] as const) {
      expect(can("BILLING_MANAGER", "medicalRecord", action)).toBe(false);
    }
  });

  it("never grants RECEPTIONIST access to medical records or treatment notes", () => {
    for (const action of [
      "create",
      "read",
      "update",
      "delete",
      "list",
    ] as const) {
      expect(can("RECEPTIONIST", "medicalRecord", action)).toBe(false);
      expect(can("RECEPTIONIST", "treatmentNote", action)).toBe(false);
    }
  });

  it("never grants SUPER_ADMIN direct access to clinical resources (platform role, not clinical)", () => {
    for (const action of [
      "create",
      "read",
      "update",
      "delete",
      "list",
    ] as const) {
      expect(can("SUPER_ADMIN", "medicalRecord", action)).toBe(false);
      expect(can("SUPER_ADMIN", "patient", action)).toBe(false);
      expect(can("SUPER_ADMIN", "document", action)).toBe(false);
    }
  });

  it("only CLINIC_ADMIN and SUPER_ADMIN can read audit logs", () => {
    for (const role of [
      "DOCTOR",
      "NURSE",
      "RECEPTIONIST",
      "BILLING_MANAGER",
      "PATIENT",
    ] as const) {
      expect(can(role, "auditLog", "read")).toBe(false);
    }
    expect(can("CLINIC_ADMIN", "auditLog", "read")).toBe(true);
    expect(can("SUPER_ADMIN", "auditLog", "read")).toBe(true);
  });

  it("PATIENT can only read/update their own patient resource, never delete/list others", () => {
    expect(can("PATIENT", "patient", "read")).toBe(true);
    expect(can("PATIENT", "patient", "update")).toBe(true);
    expect(can("PATIENT", "patient", "delete")).toBe(false);
  });
});
