import type { Activity } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export function startOfUtcDay(date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function yesterdayUtc(): Date {
  const d = startOfUtcDay();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export function ratesEqual(
  a: Prisma.Decimal | number | string,
  b: Prisma.Decimal | number | string,
): boolean {
  return new Prisma.Decimal(a).equals(new Prisma.Decimal(b));
}

/**
 * RG-04: close the current activity version and open a new one with the updated rate.
 * Lineage is matched by label + unit + siteId.
 */
export async function applyActivityRateChange(
  current: Pick<Activity, "id" | "label" | "unit" | "siteId" | "unitRate" | "validFrom">,
  newRate: Prisma.Decimal | number | string,
) {
  const closeDate = yesterdayUtc();
  const openDate = startOfUtcDay();

  return prisma.$transaction(async (tx) => {
    await tx.activity.update({
      where: { id: current.id },
      data: { validTo: closeDate, active: false },
    });

    return tx.activity.create({
      data: {
        label: current.label,
        unit: current.unit,
        siteId: current.siteId,
        unitRate: newRate,
        validFrom: openDate,
        validTo: null,
        active: true,
      },
    });
  });
}
