import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { isoWeekOfUtcDate } from "../../lib/week-iso.js";
import type { AuthUser } from "../access/auth-user.js";

const MAX_WEEKS = 26;
const DEFAULT_WEEKS = 4;
const DEFAULT_PAGE_SIZE = 50;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type SynthesisStatusGroup = "TO_VALIDATE" | "PENDING_SITE" | "VALIDATED" | "ALL";

export interface SynthesisFilters {
  weekFrom?: string;
  weekTo?: string;
  siteId?: string;
  subActivityId?: string;
  categoryId?: string;
  group?: SynthesisStatusGroup;
  offset?: number;
  take?: number;
}

export type SynthesisScope = Pick<AuthUser, "scope" | "siteId" | "teamId">;

export interface SynthesisRow {
  weekIso: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  subActivityId: string;
  activityLabel: string;
  categoryLabel: string;
  unit: string;
  people: number;
  quantity: number;
  cost: number;
  pointages: number;
  pendingSite: number;
  toValidate: number;
  validatedTechnical: number;
  rejected: number;
}

export interface SynthesisCounts {
  TO_VALIDATE: number;
  PENDING_SITE: number;
  VALIDATED: number;
  ALL: number;
}

export interface SynthesisTotals {
  cost: number;
  pendingSite: number;
  toValidate: number;
  validatedTechnical: number;
}

export interface SynthesisResponse {
  weekFrom: string;
  weekTo: string;
  rows: SynthesisRow[];
  hasMore: boolean;
  nextOffset: number | null;
  counts: SynthesisCounts;
  totals: SynthesisTotals;
  categories: Array<{ id: string; label: string }>;
}

interface LotRecord {
  week_iso: string;
  site_id: string;
  sub_id: string;
  site_code: string;
  site_name: string;
  activity_label: string;
  category_label: string;
  unit_label: string;
  people: number;
  quantity: Prisma.Decimal;
  cost: Prisma.Decimal;
  pointages: number;
  pending_site: number;
  to_validate: number;
  validated_technical: number;
  rejected: number;
}

interface SummaryRecord {
  lots_to_validate: number;
  lots_pending_site: number;
  lots_validated: number;
  lots_all: number;
  cost: Prisma.Decimal | null;
  pending_site: bigint | number | null;
  to_validate: bigint | number | null;
  validated_technical: bigint | number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveWeeks(filters: SynthesisFilters): { weekFrom: string; weekTo: string } {
  const weekTo = filters.weekTo ?? isoWeekOfUtcDate(new Date());
  const { dateFrom: toStart } = resolvePeriod(weekTo);
  const weekFrom =
    filters.weekFrom ??
    isoWeekOfUtcDate(new Date(toStart.getTime() - (DEFAULT_WEEKS - 1) * WEEK_MS));
  const { dateFrom: fromStart } = resolvePeriod(weekFrom);

  const span = Math.round((toStart.getTime() - fromStart.getTime()) / WEEK_MS) + 1;
  if (span < 1) {
    throw new ApiError(
      422,
      "INVALID_PERIOD",
      "La semaine de début doit précéder la semaine de fin",
    );
  }
  if (span > MAX_WEEKS) {
    throw new ApiError(
      422,
      "PERIOD_TOO_LONG",
      `La période ne peut pas dépasser ${MAX_WEEKS} semaines`,
    );
  }
  return { weekFrom, weekTo };
}

function scopeConditions(scope: SynthesisScope): Prisma.Sql[] | null {
  if (scope.scope === "TOUS") return [];
  if (scope.scope === "SITE") {
    return scope.siteId ? [Prisma.sql`AND w."siteId" = ${scope.siteId}::uuid`] : null;
  }
  return scope.teamId ? [Prisma.sql`AND w."teamId" = ${scope.teamId}::uuid`] : null;
}

function statusCondition(group: SynthesisStatusGroup): Prisma.Sql {
  switch (group) {
    case "TO_VALIDATE":
      return Prisma.sql`WHERE g.to_validate > 0`;
    case "PENDING_SITE":
      return Prisma.sql`WHERE g.pending_site > 0`;
    case "VALIDATED":
      return Prisma.sql`WHERE g.to_validate = 0 AND g.validated_technical > 0`;
    default:
      return Prisma.empty;
  }
}

function emptyResponse(weekFrom: string, weekTo: string): SynthesisResponse {
  return {
    weekFrom,
    weekTo,
    rows: [],
    hasMore: false,
    nextOffset: null,
    counts: { TO_VALIDATE: 0, PENDING_SITE: 0, VALIDATED: 0, ALL: 0 },
    totals: { cost: 0, pendingSite: 0, toValidate: 0, validatedTechnical: 0 },
    categories: [],
  };
}

export async function getPointageSynthesis(
  filters: SynthesisFilters,
  viewer: SynthesisScope,
): Promise<SynthesisResponse> {
  const { weekFrom, weekTo } = resolveWeeks(filters);
  const { dateFrom } = resolvePeriod(weekFrom);
  const { dateTo } = resolvePeriod(weekTo);

  const scoped = scopeConditions(viewer);
  if (scoped === null) return emptyResponse(weekFrom, weekTo);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`AND p."date" >= ${dateFrom}::date`,
    Prisma.sql`AND p."date" <= ${dateTo}::date`,
    ...scoped,
    ...(filters.siteId ? [Prisma.sql`AND w."siteId" = ${filters.siteId}::uuid`] : []),
    ...(filters.subActivityId
      ? [Prisma.sql`AND p."subActivityId" = ${filters.subActivityId}::uuid`]
      : []),
    ...(filters.categoryId ? [Prisma.sql`AND a."categoryId" = ${filters.categoryId}::uuid`] : []),
  ];

  const lots = Prisma.sql`
    SELECT
      to_char(p."date", 'IYYY-"W"IW') AS week_iso,
      w."siteId" AS site_id,
      p."subActivityId" AS sub_id,
      COUNT(*) FILTER (WHERE p.status <> 'REJECTED')::int AS pointages,
      COUNT(DISTINCT p."workerId") FILTER (WHERE p.status <> 'REJECTED')::int AS people,
      COALESCE(SUM(p.quantity) FILTER (WHERE p.status <> 'REJECTED'), 0) AS quantity,
      COALESCE(SUM(p.amount) FILTER (WHERE p.status <> 'REJECTED'), 0) AS cost,
      COUNT(*) FILTER (WHERE p.status = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE p.status IN ('PENDING', 'NEEDS_CLARIFICATION'))::int AS pending_site,
      COUNT(*) FILTER (
        WHERE p.status = 'VALIDATED' AND p."technicalValidatedAt" IS NULL
      )::int AS to_validate,
      COUNT(*) FILTER (
        WHERE p.status = 'VALIDATED' AND p."technicalValidatedAt" IS NOT NULL
      )::int AS validated_technical
    FROM "Pointage" p
    JOIN "Worker" w ON w.id = p."workerId"
    JOIN "ActivitySubActivity" a ON a.id = p."subActivityId"
    WHERE TRUE ${Prisma.join(conditions, " ")}
    GROUP BY 1, 2, 3
  `;

  const take = filters.take ?? DEFAULT_PAGE_SIZE;
  const offset = filters.offset ?? 0;

  const [pageRows, summaryRows, categories] = await Promise.all([
    prisma.$queryRaw<LotRecord[]>`
      WITH g AS (${lots})
      SELECT
        g.*,
        s."shortCode" AS site_code,
        s.name AS site_name,
        a.label AS activity_label,
        c.label AS category_label,
        u.label AS unit_label
      FROM g
      JOIN "Site" s ON s.id = g.site_id
      JOIN "ActivitySubActivity" a ON a.id = g.sub_id
      JOIN "ActivityCategory" c ON c.id = a."categoryId"
      JOIN "Unit" u ON u.id = a."unitId"
      ${statusCondition(filters.group ?? "ALL")}
      ORDER BY g.week_iso DESC, s.name ASC, a.label ASC, g.sub_id ASC
      LIMIT ${take + 1} OFFSET ${offset}
    `,
    prisma.$queryRaw<SummaryRecord[]>`
      WITH g AS (${lots})
      SELECT
        COUNT(*) FILTER (WHERE g.to_validate > 0)::int AS lots_to_validate,
        COUNT(*) FILTER (WHERE g.pending_site > 0)::int AS lots_pending_site,
        COUNT(*) FILTER (WHERE g.to_validate = 0 AND g.validated_technical > 0)::int AS lots_validated,
        COUNT(*)::int AS lots_all,
        SUM(g.cost) AS cost,
        SUM(g.pending_site) AS pending_site,
        SUM(g.to_validate) AS to_validate,
        SUM(g.validated_technical) AS validated_technical
      FROM g
    `,
    prisma.activityCategory.findMany({
      where: { active: true },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
  ]);

  const summary = summaryRows[0];
  const hasMore = pageRows.length > take;
  const page = hasMore ? pageRows.slice(0, take) : pageRows;

  return {
    weekFrom,
    weekTo,
    rows: page.map((row) => ({
      weekIso: row.week_iso,
      siteId: row.site_id,
      siteCode: row.site_code,
      siteName: row.site_name,
      subActivityId: row.sub_id,
      activityLabel: row.activity_label,
      categoryLabel: row.category_label,
      unit: row.unit_label,
      people: row.people,
      quantity: round2(Number(row.quantity)),
      cost: round2(Number(row.cost)),
      pointages: row.pointages,
      pendingSite: row.pending_site,
      toValidate: row.to_validate,
      validatedTechnical: row.validated_technical,
      rejected: row.rejected,
    })),
    hasMore,
    nextOffset: hasMore ? offset + take : null,
    counts: {
      TO_VALIDATE: summary?.lots_to_validate ?? 0,
      PENDING_SITE: summary?.lots_pending_site ?? 0,
      VALIDATED: summary?.lots_validated ?? 0,
      ALL: summary?.lots_all ?? 0,
    },
    totals: {
      cost: round2(Number(summary?.cost ?? 0)),
      pendingSite: Number(summary?.pending_site ?? 0),
      toValidate: Number(summary?.to_validate ?? 0),
      validatedTechnical: Number(summary?.validated_technical ?? 0),
    },
    categories,
  };
}
