import { PatientAccessPolicy } from "./patients.policy";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import type { TenantPrismaClient } from "../../common/types/policy";

function makeTx(
  overrides: Partial<Record<string, unknown>> = {},
): TenantPrismaClient {
  return {
    patientProfile: { findFirst: jest.fn().mockResolvedValue(null) },
    doctorProfile: { findFirst: jest.fn().mockResolvedValue(null) },
    appointment: { findFirst: jest.fn().mockResolvedValue(null) },
    medicalRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    ...overrides,
  } as unknown as TenantPrismaClient;
}

const tenant: TenantContext = { clinicId: "clinic-a" };

describe("PatientAccessPolicy", () => {
  const policy = new PatientAccessPolicy();

  it("allows CLINIC_ADMIN unconditionally", async () => {
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "CLINIC_ADMIN",
      clinicId: "clinic-a",
      membershipId: "m1",
    };
    const allowed = await policy.check({
      user,
      tenant,
      params: { id: "patient-x" },
      tx: makeTx(),
    });
    expect(allowed).toBe(true);
  });

  it("denies a PATIENT accessing a profile that isn't their own", async () => {
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "PATIENT",
      clinicId: "clinic-a",
      membershipId: "m1",
    };
    const tx = makeTx({
      patientProfile: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const allowed = await policy.check({
      user,
      tenant,
      params: { id: "someone-elses-id" },
      tx,
    });
    expect(allowed).toBe(false);
  });

  it("allows a PATIENT accessing their own profile", async () => {
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "PATIENT",
      clinicId: "clinic-a",
      membershipId: "m1",
    };
    const tx = makeTx({
      patientProfile: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "patient-x", userId: "u1" }),
      },
    });
    const allowed = await policy.check({
      user,
      tenant,
      params: { id: "patient-x" },
      tx,
    });
    expect(allowed).toBe(true);
  });

  it("denies a DOCTOR with no care-team relationship to the patient", async () => {
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "DOCTOR",
      clinicId: "clinic-a",
      membershipId: "m1",
    };
    const tx = makeTx({
      doctorProfile: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "doc-1", membershipId: "m1" }),
      },
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      medicalRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const allowed = await policy.check({
      user,
      tenant,
      params: { id: "patient-x" },
      tx,
    });
    expect(allowed).toBe(false);
  });

  it("allows a DOCTOR who has an appointment with the patient", async () => {
    const user: AuthenticatedUser = {
      sub: "u1",
      isSuperAdmin: false,
      role: "DOCTOR",
      clinicId: "clinic-a",
      membershipId: "m1",
    };
    const tx = makeTx({
      doctorProfile: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "doc-1", membershipId: "m1" }),
      },
      appointment: { findFirst: jest.fn().mockResolvedValue({ id: "appt-1" }) },
      medicalRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const allowed = await policy.check({
      user,
      tenant,
      params: { id: "patient-x" },
      tx,
    });
    expect(allowed).toBe(true);
  });

  it("denies an unrecognized role", async () => {
    const user = {
      sub: "u1",
      isSuperAdmin: false,
      role: undefined,
      clinicId: "clinic-a",
      membershipId: "m1",
    } as AuthenticatedUser;
    const allowed = await policy.check({
      user,
      tenant,
      params: { id: "patient-x" },
      tx: makeTx(),
    });
    expect(allowed).toBe(false);
  });
});
