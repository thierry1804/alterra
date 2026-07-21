import { deleteSetting, getSetting, setSetting } from "../db/db";

export const SETTING_DAY_SESSION = "daySession";
export const SETTING_REFERENTIALS_SYNCED_AT = "referentialsSyncedAt";

export interface DaySession {
  activityId: string;
  date: string;
  defaultQuantity: number;
}

export async function getDaySession(): Promise<DaySession | null> {
  const raw = await getSetting(SETTING_DAY_SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DaySession;
  } catch {
    return null;
  }
}

export async function saveDaySession(session: DaySession): Promise<void> {
  await setSetting(SETTING_DAY_SESSION, JSON.stringify(session));
}

export async function clearDaySession(): Promise<void> {
  await deleteSetting(SETTING_DAY_SESSION);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Jour courant + 3 jours précédents (RG saisie PWA). */
export function selectableDates(): string[] {
  const dates: string[] = [];
  const base = new Date();
  for (let offset = 0; offset < 4; offset += 1) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() - offset);
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

export function formatDisplayDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
