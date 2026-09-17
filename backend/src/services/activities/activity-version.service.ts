import type { ActivitySubActivity } from "@prisma/client";
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

export interface SubActivityRateChangeOverrides {
  label?: string;
  shortLabel?: string;
  unitId?: string;
  siteId?: string | null;
  validFrom?: Date;
  active?: boolean;
}

/** Compute RG-04 close/open dates from the current row's validFrom and optional override. */
export function computeRateChangeDates(
  currentValidFrom: Date,
  overrideValidFrom?: Date,
): { closeDate: Date; openDate: Date } {
  const currentFrom = startOfUtcDay(currentValidFrom);
  const openDate = startOfUtcDay(overrideValidFrom ?? new Date());

  if (currentFrom.getTime() >= openDate.getTime()) {
    const nextDay = new Date(currentFrom);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return { closeDate: currentFrom, openDate: nextDay };
  }

  const closeDate = new Date(openDate);
  closeDate.setUTCDate(closeDate.getUTCDate() - 1);
  return { closeDate, openDate };
}

/**
 * RG-04: close the current sub-activity version and open a new one with the updated rate.
 * Lineage is matched by categoryId + label + unit + siteId — la catégorie ne change jamais ici.
 */
export async function applySubActivityRateChange(
  current: Pick<
    ActivitySubActivity,
    | "id"
    | "categoryId"
    | "label"
    | "shortLabel"
    | "unitId"
    | "siteId"
    | "groupKey"
    | "unitRate"
    | "validFrom"
    | "active"
  >,
  newRate: Prisma.Decimal | number | string,
  overrides: SubActivityRateChangeOverrides = {},
) {
  const { closeDate, openDate } = computeRateChangeDates(current.validFrom, overrides.validFrom);

  return prisma.$transaction(async (tx) => {
    await tx.activitySubActivity.update({
      where: { id: current.id },
      data: { validTo: closeDate, active: false },
    });

    return tx.activitySubActivity.create({
      data: {
        categoryId: current.categoryId,
        label: overrides.label ?? current.label,
        shortLabel: overrides.shortLabel ?? current.shortLabel,
        unitId: overrides.unitId ?? current.unitId,
        siteId: overrides.siteId !== undefined ? overrides.siteId : current.siteId,
        groupKey: current.groupKey,
        unitRate: newRate,
        validFrom: openDate,
        validTo: null,
        active: overrides.active ?? current.active ?? true,
      },
      include: { category: true, unit: true },
    });
  });
}
