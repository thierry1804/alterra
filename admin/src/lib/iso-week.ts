const DAY_MS = 86_400_000;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;

export function isoWeekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function weekStart(weekIso: string): Date {
  const match = weekIso.match(WEEK_RE);
  if (!match) throw new Error(`Semaine ISO invalide : ${weekIso}`);
  const jan4 = new Date(Date.UTC(Number(match[1]), 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAY_MS);
  return new Date(monday.getTime() + (Number(match[2]) - 1) * 7 * DAY_MS);
}

export function weekEnd(weekIso: string): Date {
  return new Date(weekStart(weekIso).getTime() + 6 * DAY_MS);
}

export function recentWeeks(count: number, from: Date = new Date()): string[] {
  const current = weekStart(isoWeekOf(from));
  return Array.from({ length: count }, (_, index) =>
    isoWeekOf(new Date(current.getTime() - index * 7 * DAY_MS)),
  );
}

export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function weekLabel(weekIso: string): string {
  const format = (date: Date) =>
    date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return `S${Number(weekIso.slice(6))} · ${format(weekStart(weekIso))} – ${format(weekEnd(weekIso))}`;
}
