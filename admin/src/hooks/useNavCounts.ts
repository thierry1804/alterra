import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DashboardSummary } from "../lib/dashboard";
import {
  fetchActivityRequests,
  fetchClarificationRequests,
  fetchWorkerRequests,
} from "../lib/workflows";
import { useSiteScope } from "../lib/site-scope";
import { hasPermission } from "../lib/permissions";
import { useAuth } from "./useAuth";

export interface NavCounts {
  requests: number;
  pointages: number;
  payments: number;
  technical: number;
  bordereaux: number;
  export: number;
}

const REFRESH_MS = 60_000;

/** Ce qui attend un geste : demandes, pointages à valider, validations techniques, bordereaux à valider ou à exporter. */
export function useNavCounts(): NavCounts {
  const { user } = useAuth();
  const decidesRequests = hasPermission(user, "demande:decider");
  const [siteId] = useSiteScope();

  const kpis = useQuery({
    queryKey: ["dashboard", "kpis", siteId],
    queryFn: () =>
      api
        .get<DashboardSummary>("/dashboard/kpis", { params: { siteId: siteId || undefined } })
        .then((r) => r.data),
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
    enabled: decidesRequests,
  });

  return {
    requests: requests.data ?? 0,
    pointages: kpis.data?.kpis.pendingPointages ?? 0,
    payments: kpis.data?.kpis.pendingPaymentsCount ?? 0,
    technical: kpis.data?.kpis.pendingTechnicalPointages ?? 0,
    bordereaux: kpis.data?.kpis.bordereauxToValidate ?? 0,
    export: kpis.data?.kpis.bordereauxToExport ?? 0,
  };
}
