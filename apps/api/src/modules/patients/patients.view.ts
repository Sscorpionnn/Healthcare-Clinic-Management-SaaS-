import { decryptField, decryptOptionalField } from "@clinic/database";
import type { AuthenticatedUser } from "../../common/types/auth.types";

interface RawPatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContact: string | null;
  createdAt: Date;
}

/** BILLING_MANAGER never receives clinical/identifying fields beyond a name — see docs/rbac.md. */
export function toPatientView(patient: RawPatient, viewer: AuthenticatedUser) {
  const firstName = decryptField(patient.firstName);
  const lastName = decryptField(patient.lastName);

  if (viewer.role === "BILLING_MANAGER") {
    return { id: patient.id, firstName, lastName };
  }

  return {
    id: patient.id,
    firstName,
    lastName,
    dateOfBirth: decryptField(patient.dateOfBirth),
    phone: decryptOptionalField(patient.phone),
    email: decryptOptionalField(patient.email),
    address: patient.address ? JSON.parse(decryptField(patient.address)) : null,
    emergencyContact: patient.emergencyContact
      ? JSON.parse(decryptField(patient.emergencyContact))
      : null,
    createdAt: patient.createdAt,
  };
}
