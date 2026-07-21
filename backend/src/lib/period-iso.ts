import { PaymentCycle } from "@prisma/client";
import { ApiError } from "../middleware/error-handler.js";
import { getIsoWeekString } from "./week-iso.js";

export interface ResolvedPeriod {
  weekIso: string;
  shortPeriod: string;
  cycle: PaymentCycle;
  dateFrom: Date;
  dateTo: Date;
}

const FULL_WEEK_RE = /^(\d{4})-W(\d{2})$/;
const SHORT_WEEK_RE = /^S(\d{1,2})$/i;
const DAILY_RE = /^D(\d{1,3})$/i;

function getIsoWeekDateRange(weekIso: string): { dateFrom: Date; dateTo: Date } {
  const match = weekIso.match(FULL_WEEK_RE);
  if (!match) {
    throw new ApiError(422, "INVALID_PERIOD", `Invalid ISO week: ${weekIso}`);
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) {
    throw new ApiError(422, "INVALID_PERIOD", `Week out of range: ${weekIso}`);
  }

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const dateFrom = new Date(week1Monday);
  dateFrom.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  const dateTo = new Date(dateFrom);
  dateTo.setUTCDate(dateFrom.getUTCDate() + 6);

  return { dateFrom, dateTo };
}

function getDayOfYearDateRange(year: number, dayOfYear: number): { dateFrom: Date; dateTo: Date } {
  if (dayOfYear < 1 || dayOfYear > 366) {
    throw new ApiError(422, "INVALID_PERIOD", `Day out of range: D${dayOfYear}`);
  }

  const dateFrom = new Date(Date.UTC(year, 0, dayOfYear));
  return { dateFrom, dateTo: new Date(dateFrom) };
}

/** Resolve period input (2026-W18, S18, D138) to week/day bounds and short export label. */
export function resolvePeriod(
  periodIso: string,
  cycle?: PaymentCycle,
  referenceYear = new Date().getFullYear(),
): ResolvedPeriod {
  const trimmed = periodIso.trim();

  const fullWeekMatch = trimmed.match(FULL_WEEK_RE);
  if (fullWeekMatch) {
    const weekIso = trimmed;
    const shortPeriod = `S${fullWeekMatch[2]}`;
    const { dateFrom, dateTo } = getIsoWeekDateRange(weekIso);
    return {
      weekIso,
      shortPeriod,
      cycle: cycle ?? PaymentCycle.WEEKLY,
      dateFrom,
      dateTo,
    };
  }

  const shortWeekMatch = trimmed.match(SHORT_WEEK_RE);
  if (shortWeekMatch) {
    const weekNum = shortWeekMatch[1].padStart(2, "0");
    const weekIso = `${referenceYear}-W${weekNum}`;
    const { dateFrom, dateTo } = getIsoWeekDateRange(weekIso);
    return {
      weekIso,
      shortPeriod: `S${Number(shortWeekMatch[1])}`,
      cycle: cycle ?? PaymentCycle.WEEKLY,
      dateFrom,
      dateTo,
    };
  }

  const dailyMatch = trimmed.match(DAILY_RE);
  if (dailyMatch) {
    const dayNum = Number(dailyMatch[1]);
    const shortPeriod = `D${String(dayNum).padStart(3, "0")}`;
    const { dateFrom, dateTo } = getDayOfYearDateRange(referenceYear, dayNum);
    return {
      weekIso: getIsoWeekString(dateFrom),
      shortPeriod,
      cycle: cycle ?? PaymentCycle.DAILY,
      dateFrom,
      dateTo,
    };
  }

  throw new ApiError(
    422,
    "INVALID_PERIOD",
    "periodIso must be 2026-W18, S18, or D138 format",
  );
}
