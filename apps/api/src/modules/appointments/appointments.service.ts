import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateAppointmentInput,
  RescheduleAppointmentInput,
} from "@clinic/shared";
import type { AppointmentStatus } from "@clinic/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import type {
  AuthenticatedUser,
  TenantContext,
} from "../../common/types/auth.types";
import {
  parsePagination,
  paginated,
  type PaginationQuery,
} from "../../common/utils/pagination";

const ACTIVE_STATUSES: AppointmentStatus[] = [
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
];

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenant: TenantContext,
    input: CreateAppointmentInput,
    viewer: AuthenticatedUser,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      let patientId = input.patientId;
      if (viewer.role === "PATIENT") {
        const own = await tx.patientProfile.findFirst({
          where: { userId: viewer.sub },
        });
        if (!own)
          throw new BadRequestException(
            "No patient profile linked to this account",
          );
        patientId = own.id;
      } else {
        const patient = await tx.patientProfile.findFirst({
          where: { id: patientId, deletedAt: null },
        });
        if (!patient) throw new NotFoundException("Patient not found");
      }

      const doctor = await tx.doctorProfile.findFirst({
        where: { id: input.doctorId },
      });
      if (!doctor) throw new NotFoundException("Doctor not found");

      const overlapping = await tx.appointment.findFirst({
        where: {
          doctorId: input.doctorId,
          status: { in: [...ACTIVE_STATUSES] },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
      });
      if (overlapping)
        throw new ConflictException("This time slot is no longer available");

      return tx.appointment.create({
        data: {
          clinicId: tenant.clinicId,
          patientId,
          doctorId: input.doctorId,
          departmentId: input.departmentId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          reason: input.reason,
          createdByMembershipId: viewer.membershipId,
        },
      });
    });
  }

  async list(
    tenant: TenantContext,
    viewer: AuthenticatedUser,
    query: PaginationQuery,
  ) {
    const pagination = parsePagination(query);
    return this.prisma.runTenant(tenant, async (tx) => {
      let where: Record<string, unknown> = {};
      if (viewer.role === "DOCTOR") {
        const doctor = await tx.doctorProfile.findFirst({
          where: { membershipId: viewer.membershipId },
        });
        where = { doctorId: doctor?.id ?? "__none__" };
      } else if (viewer.role === "PATIENT") {
        const patient = await tx.patientProfile.findFirst({
          where: { userId: viewer.sub },
        });
        where = { patientId: patient?.id ?? "__none__" };
      }

      const [data, total] = await Promise.all([
        tx.appointment.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { startsAt: "desc" },
        }),
        tx.appointment.count({ where }),
      ]);
      return paginated(data, total, pagination);
    });
  }

  async get(tenant: TenantContext, id: string) {
    const appointment = await this.prisma.runTenant(tenant, (tx) =>
      tx.appointment.findFirst({ where: { id } }),
    );
    if (!appointment) throw new NotFoundException();
    return appointment;
  }

  private async transition(
    tenant: TenantContext,
    id: string,
    from: AppointmentStatus[],
    to: AppointmentStatus,
    extra?: Record<string, unknown>,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.appointment.updateMany({
        where: { id, status: { in: from } },
        data: { status: to, ...extra },
      });
      if (result.count === 0) {
        const exists = await tx.appointment.findFirst({ where: { id } });
        if (!exists) throw new NotFoundException();
        throw new ConflictException(
          `Appointment cannot transition from ${exists.status} to ${to}`,
        );
      }
      return tx.appointment.findFirst({ where: { id } });
    });
  }

  confirm(tenant: TenantContext, id: string) {
    return this.transition(tenant, id, ["REQUESTED"], "CONFIRMED");
  }

  checkIn(tenant: TenantContext, id: string) {
    return this.transition(tenant, id, ["CONFIRMED"], "CHECKED_IN");
  }

  complete(tenant: TenantContext, id: string) {
    return this.transition(tenant, id, ["CHECKED_IN"], "COMPLETED");
  }

  cancel(tenant: TenantContext, id: string, reason: string) {
    return this.transition(tenant, id, [...ACTIVE_STATUSES], "CANCELLED", {
      cancelReason: reason,
    });
  }

  markNoShow(tenant: TenantContext, id: string) {
    return this.transition(tenant, id, ["CONFIRMED"], "NO_SHOW");
  }

  async reschedule(
    tenant: TenantContext,
    id: string,
    input: RescheduleAppointmentInput,
  ) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const appointment = await tx.appointment.findFirst({ where: { id } });
      if (!appointment) throw new NotFoundException();
      if (!ACTIVE_STATUSES.includes(appointment.status)) {
        throw new ConflictException(
          "Only active appointments can be rescheduled",
        );
      }

      const overlapping = await tx.appointment.findFirst({
        where: {
          id: { not: id },
          doctorId: appointment.doctorId,
          status: { in: [...ACTIVE_STATUSES] },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
      });
      if (overlapping)
        throw new ConflictException("This time slot is no longer available");

      const result = await tx.appointment.updateMany({
        where: { id },
        data: {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status: "REQUESTED",
        },
      });
      if (result.count === 0) throw new NotFoundException();
      return tx.appointment.findFirst({ where: { id } });
    });
  }
}
