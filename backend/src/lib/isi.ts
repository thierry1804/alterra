import { Prisma, type IsiRounding } from "@prisma/client";
import { prisma } from "./prisma.js";

export interface IsiSettings {
  rate: Prisma.Decimal;
  rounding: IsiRounding;
}

export const DEFAULT_ISI_SETTINGS: IsiSettings = {
  rate: new Prisma.Decimal("0.05"),
  rounding: "UNIT",
};

export async function getIsiSettings(): Promise<IsiSettings> {
  const row = await prisma.appSetting.findUnique({
    where: { id: "singleton" },
    select: { isiRate: true, isiRounding: true },
  });
  if (!row) return DEFAULT_ISI_SETTINGS;
  return { rate: new Prisma.Decimal(row.isiRate), rounding: row.isiRounding };
}

export function lineIsi(amount: Prisma.Decimal.Value, settings: IsiSettings): Prisma.Decimal {
  const raw = new Prisma.Decimal(amount).mul(settings.rate);
  return raw.toDecimalPlaces(settings.rounding === "UNIT" ? 0 : 2, Prisma.Decimal.ROUND_HALF_UP);
}

export function isiLineKey(pointage: {
  workerId: string;
  subActivityId: string;
  unitRateSnapshot: Prisma.Decimal.Value;
}): string {
  return `${pointage.workerId}|${pointage.subActivityId}|${new Prisma.Decimal(pointage.unitRateSnapshot).toString()}`;
}

export function ratePercentLabel(rate: Prisma.Decimal.Value): string {
  return String(Number(new Prisma.Decimal(rate).mul(100).toDecimalPlaces(2).toString()));
}
