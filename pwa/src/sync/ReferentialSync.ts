import { api } from "../lib/api";
import {
  db,
  setSetting,
  type ActivityRecord,
  type BadgeRecord,
  type ParcelleRecord,
  type WorkerRecord,
  type ZoneRecord,
} from "../db/db";
import { SETTING_GEO_SYNCED_AT, SETTING_REFERENTIALS_SYNCED_AT } from "../lib/day-session";
import { normalizeTagId } from "../lib/nfc";

interface ApiWorker {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  siteId: string;
  teamId: string | null;
  status: string;
  sexe: "MASCULIN" | "FEMININ" | null;
}

interface ApiSubActivity {
  id: string;
  categoryId: string;
  category?: { code: string; label: string };
  label: string;
  shortLabel: string;
  unit?: { code: string; label: string };
  unitRate: string | number;
  siteId: string | null;
  active: boolean;
}

export interface ReferentialSyncResult {
  workers: number;
  activities: number;
  badges: number;
  parcelles: number;
}

export async function syncReferentials(options: {
  siteId?: string | null;
  teamId?: string | null;
}): Promise<ReferentialSyncResult> {
  if (!navigator.onLine) {
    return {
      workers: await db.workers.count(),
      activities: await db.activities.count(),
      badges: await db.badges.count(),
      parcelles: await db.parcelles.count(),
    };
  }

  const workerParams: Record<string, string | number> = {
    status: "ACTIVE",
    take: 100,
  };
  if (options.siteId) workerParams.siteId = options.siteId;
  if (options.teamId) workerParams.teamId = options.teamId;

  const workers: WorkerRecord[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<{
      data: ApiWorker[];
      nextCursor: string | null;
      hasMore: boolean;
    }>("/workers", {
      params: cursor ? { ...workerParams, cursor } : workerParams,
    });

    workers.push(
      ...response.data.data.map((worker) => ({
        id: worker.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        matricule: worker.matricule,
        teamId: worker.teamId,
        siteId: worker.siteId,
        sexe: worker.sexe,
      })),
    );

    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  const activityParams: Record<string, string | number> = { active: "true", take: 100 };
  if (options.siteId) activityParams.siteId = options.siteId;

  const apiActivities: ApiSubActivity[] = [];
  let activityCursor: string | undefined;

  do {
    const response = await api.get<{
      data: ApiSubActivity[];
      nextCursor: string | null;
      hasMore: boolean;
    }>("/sub-activities", {
      params: activityCursor ? { ...activityParams, cursor: activityCursor } : activityParams,
    });

    apiActivities.push(...response.data.data);
    activityCursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (activityCursor);

  const activities: ActivityRecord[] = apiActivities.map((activity) => ({
    id: activity.id,
    label: activity.label,
    categoryCode: activity.category?.code ?? "",
    unit: activity.unit?.label ?? "",
    unitRate: Number(activity.unitRate),
    siteId: activity.siteId,
    active: activity.active,
  }));

  const badgeParams: Record<string, string> = { active: "true" };
  if (options.teamId) badgeParams.teamId = options.teamId;

  const badgesResponse = await api.get<{
    data: Array<{ nfcTagId: string; workerId: string }>;
  }>("/badges", { params: badgeParams });

  const badges: BadgeRecord[] = badgesResponse.data.data.map((badge) => ({
    nfcTagId: normalizeTagId(badge.nfcTagId),
    workerId: badge.workerId,
  }));

  const geoParams: Record<string, string> = {};
  if (options.siteId) geoParams.siteId = options.siteId;

  const zonesResponse = await api.get<{
    data: Array<{ id: string; siteId: string; name: string; code: string | null }>;
  }>("/zones", { params: geoParams });
  const zones: ZoneRecord[] = zonesResponse.data.data.map((zone) => ({
    id: zone.id,
    siteId: zone.siteId,
    name: zone.name,
    code: zone.code,
  }));

  const parcelsResponse = await api.get<{
    data: Array<{
      id: string;
      zoneId: string;
      name: string;
      code: string | null;
      kind: "PARCELLE" | "PEPINIERE";
      zone?: { siteId: string };
    }>;
  }>("/parcels", { params: geoParams });
  const siteByZone = new Map(zones.map((zone) => [zone.id, zone.siteId]));
  const parcelles: ParcelleRecord[] = parcelsResponse.data.data.map((parcel) => ({
    id: parcel.id,
    zoneId: parcel.zoneId,
    siteId: parcel.zone?.siteId ?? siteByZone.get(parcel.zoneId) ?? "",
    name: parcel.name,
    code: parcel.code,
    kind: parcel.kind,
  }));

  await db.transaction(
    "rw",
    [db.workers, db.activities, db.badges, db.zones, db.parcelles],
    async () => {
      await db.workers.clear();
      await db.activities.clear();
      await db.badges.clear();
      await db.zones.clear();
      await db.parcelles.clear();
      if (zones.length > 0) await db.zones.bulkPut(zones);
      if (parcelles.length > 0) await db.parcelles.bulkPut(parcelles);
      if (workers.length > 0) await db.workers.bulkPut(workers);
      if (activities.length > 0) await db.activities.bulkPut(activities);
      if (badges.length > 0) await db.badges.bulkPut(badges);
    },
  );

  await setSetting(SETTING_REFERENTIALS_SYNCED_AT, new Date().toISOString());
  await setSetting(SETTING_GEO_SYNCED_AT, new Date().toISOString());

  return {
    workers: workers.length,
    activities: activities.length,
    badges: badges.length,
    parcelles: parcelles.length,
  };
}
