import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  fetchActivityRequests,
  fetchClarificationRequests,
  fetchWorkerRequests,
  type ActivityRequestRow,
  type ClarificationRequestRow,
  type WorkerRequestRow,
} from "../lib/workflows";
import type { Pointage } from "../lib/pointages";
import { fetchAllCursorPages } from "../components/ui/data-table/fetchAllPages";
import { useAuth } from "./useAuth";

export type NotificationItem =
  | { type: "activity"; id: string; createdAt: string; row: ActivityRequestRow }
  | { type: "worker"; id: string; createdAt: string; row: WorkerRequestRow }
  | { type: "clarification"; id: string; createdAt: string; row: ClarificationRequestRow }
  | { type: "pointage"; id: string; createdAt: string; row: Pointage };

const REFRESH_MS = 30_000;

async function fetchPendingPointages(): Promise<Pointage[]> {
  return fetchAllCursorPages<Pointage>((cursor) =>
    api
      .get<{ data: Pointage[]; nextCursor: string | null; hasMore: boolean }>("/pointages", {
        params: { status: "PENDING", cursor: cursor ?? undefined },
      })
      .then((r) => r.data),
  );
}

export function useNotificationFeed(enabled: boolean) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const query = useQuery({
    queryKey: ["nav", "notification-feed"],
    queryFn: async () => {
      const [activities, workers, clarifications, pointages] = await Promise.all([
        fetchActivityRequests("PENDING"),
        fetchWorkerRequests("PENDING"),
        fetchClarificationRequests("OPEN"),
        fetchPendingPointages(),
      ]);
      return { activities, workers, clarifications, pointages };
    },
    enabled: enabled && isAdmin,
    staleTime: REFRESH_MS,
    refetchInterval: enabled ? REFRESH_MS : false,
  });

  const data = query.data;
  const counts = {
    activities: data?.activities.length ?? 0,
    workers: data?.workers.length ?? 0,
    clarifications: data?.clarifications.length ?? 0,
    pointages: data?.pointages.length ?? 0,
  };

  const items: NotificationItem[] = data
    ? [
        ...data.activities.map((row) => ({
          type: "activity" as const,
          id: row.id,
          createdAt: row.createdAt,
          row,
        })),
        ...data.workers.map((row) => ({
          type: "worker" as const,
          id: row.id,
          createdAt: row.createdAt,
          row,
        })),
        ...data.clarifications.map((row) => ({
          type: "clarification" as const,
          id: row.id,
          createdAt: row.createdAt,
          row,
        })),
        ...data.pointages.map((row) => ({
          type: "pointage" as const,
          id: row.id,
          createdAt: row.createdAt,
          row,
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  return { isLoading: query.isLoading, counts, items };
}
