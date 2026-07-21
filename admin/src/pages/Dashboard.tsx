import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import type { DashboardSummary } from "../lib/dashboard";
import KpiCards from "../components/dashboard/KpiCards";
import PresenceChart from "../components/dashboard/PresenceChart";
import WorkforceChart from "../components/dashboard/WorkforceChart";
import AlertsBlock from "../components/dashboard/AlertsBlock";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

const REFRESH_MS = 60_000;

export default function Dashboard() {
  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/kpis").then((r) => r.data),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-zinc-600">
            KPIs campagne, présence terrain et paiements.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      <ContextHelp id="dashboard-admin" title="Tableau de bord" persistDismiss={false}>
        <GlossaryTerm term="Présence semaine">
          Taux de travailleurs pointés sur la période en cours.
        </GlossaryTerm>
        <GlossaryTerm term="Paiements en attente">
          Montant MVola non encore exporté pour la campagne active.
        </GlossaryTerm>
      </ContextHelp>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-40" />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger le tableau de bord.
        </p>
      )}

      {data && (
        <>
          <KpiCards kpis={data.kpis} />
          <div className="grid gap-4 xl:grid-cols-2">
            <PresenceChart data={data.presenceLast7Days} />
            <WorkforceChart data={data.workforceTrend} />
          </div>
          <AlertsBlock alerts={data.alerts} />
        </>
      )}
    </div>
  );
}
