import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DashboardSummary } from "../lib/dashboard";
import {
  fetchActivityRequests,
  fetchClarificationRequests,
  fetchWorkerRequests,
} from "../lib/workflows";
import { useAuth } from "./useAuth";

export interface NavCounts {
  requests: number;
  pointages: number;
  payments: number;
}

const REFRESH_MS = 60_000;

/** Ce qui attend un geste : demandes en attente, pointages à valider, lignes de paiement non exportées. */
export function useNavCounts(): NavCounts {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const kpis = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/kpis").then((r) => r.data),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
    enabled: Boolean(user),
  });

  const requests = useQuery({
    queryKey: ["nav", "pending-requests"],
    queryFn: async () => {
      const [activities, workers, clarifications] = await Promise.all([
        fetchActivityRequests("PENDING"),
        fetchWorkerRequests("PENDING"),
        fetchClarificationRequests("OPEN"),
      ]);
      return activities.length + workers.length + clarifications.length;
    },
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
    enabled: isAdmin,
  });

  return {
    requests: requests.data ?? 0,
    pointages: kpis.data?.kpis.pendingPointages ?? 0,
    payments: kpis.data?.kpis.pendingPaymentsCount ?? 0,
  };
}
