import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/** Taux d'ISI et nombre de décimales des montants de paiement (0 à 2), figés sur le bordereau à sa génération. */
export interface IsiSettings {
  rate: Prisma.Decimal;
  decimals: number;
}

export const MAX_AMOUNT_DECIMALS = 2;

const DEFAULT_ISI_SETTINGS: IsiSettings = {
  rate: new Prisma.Decimal("0.05"),
  decimals: 0,
};

export function clampDecimals(value: number): number {
  return Number.isInteger(value) ? Math.min(Math.max(value, 0), MAX_AMOUNT_DECIMALS) : 0;
}

export async function getIsiSettings(): Promise<IsiSettings> {
  const row = await prisma.appSetting.findUnique({
    where: { id: "singleton" },
    select: { isiRate: true, amountDecimals: true },
  });
  if (!row) return DEFAULT_ISI_SETTINGS;
  return { rate: new Prisma.Decimal(row.isiRate), decimals: clampDecimals(row.amountDecimals) };
}

/** Réglages tels que figés sur un bordereau. */
export function isiSettingsOf(bordereau: {
  isiRate: Prisma.Decimal.Value;
  amountDecimals: number;
}): IsiSettings {
  return {
    rate: new Prisma.Decimal(bordereau.isiRate),
    decimals: clampDecimals(bordereau.amountDecimals),
  };
}

/** Arrondi commercial (0,5 vers le haut) au nombre de décimales réglé. */
export function roundAmount(amount: Prisma.Decimal.Value, decimals: number): Prisma.Decimal {
  return new Prisma.Decimal(amount).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
}

/** Montant brut d'une ligne (travailleur × activité × tarif) arrondi au réglage. */
export function lineGross(amount: Prisma.Decimal.Value, settings: IsiSettings): Prisma.Decimal {
  return roundAmount(amount, settings.decimals);
}

/** ISI d'une ligne, calculé sur son brut arrondi puis arrondi à son tour. */
export function lineIsi(amount: Prisma.Decimal.Value, settings: IsiSettings): Prisma.Decimal {
  return roundAmount(new Prisma.Decimal(amount).mul(settings.rate), settings.decimals);
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
