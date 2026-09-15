import { Injectable, NotFoundException } from "@nestjs/common";
import type { AvailabilitySlotInput } from "@clinic/shared";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { TenantContext } from "../../common/types/auth.types";

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenant: TenantContext, doctorId: string) {
    return this.prisma.runTenant(tenant, (tx) =>
      tx.availabilitySlot.findMany({
        where: { doctorId },
        orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      }),
    );
  }

  create(
    tenant: TenantContext,
    doctorId: string,
    input: AvailabilitySlotInput,
  ) {
    return this.prisma.runTenant(tenant, (tx) =>
      tx.availabilitySlot.create({
        data: { ...input, doctorId, clinicId: tenant.clinicId },
      }),
    );
  }

  async remove(tenant: TenantContext, doctorId: string, slotId: string) {
    return this.prisma.runTenant(tenant, async (tx) => {
      const result = await tx.availabilitySlot.deleteMany({
        where: { id: slotId, doctorId },
      });
      if (result.count === 0) throw new NotFoundException();
    });
  }

  /** Subtracts existing non-cancelled appointments from the doctor's weekly slots for the given date. */
  async availableSlots(
    tenant: TenantContext,
    doctorId: string,
    dateStr: string,
  ) {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()))
      throw new NotFoundException("Invalid date");
    const dayOfWeek = date.getUTCDay();

    return this.prisma.runTenant(tenant, async (tx) => {
      const [slots, appointments] = await Promise.all([
        tx.availabilitySlot.findMany({
          where: {
            doctorId,
            dayOfWeek,
            effectiveFrom: { lte: date },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
          },
        }),
        tx.appointment.findMany({
          where: {
            doctorId,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            startsAt: {
              gte: date,
              lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          select: { startsAt: true, endsAt: true },
        }),
      ]);

      const dayStart = date.getTime();
      const booked = appointments.map((a) => ({
        startMinute: Math.round((a.startsAt.getTime() - dayStart) / 60000),
        endMinute: Math.round((a.endsAt.getTime() - dayStart) / 60000),
      }));

      const SLOT_MINUTES = 30;
      const free: { startMinute: number; endMinute: number }[] = [];
      for (const slot of slots) {
        for (
          let m = slot.startMinute;
          m + SLOT_MINUTES <= slot.endMinute;
          m += SLOT_MINUTES
        ) {
          const candidateEnd = m + SLOT_MINUTES;
          const overlaps = booked.some(
            (b) => m < b.endMinute && candidateEnd > b.startMinute,
          );
          if (!overlaps) free.push({ startMinute: m, endMinute: candidateEnd });
        }
      }
      return free;
    });
  }
}
