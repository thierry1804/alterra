import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import type { DashboardSummary } from "../lib/dashboard";
import KpiCards from "../components/dashboard/KpiCards";
import PresenceChart from "../components/dashboard/PresenceChart";
import WorkforceChart from "../components/dashboard/WorkforceChart";
import GenderBreakdownChart from "../components/dashboard/GenderBreakdownChart";
import GenderRatioBarChart from "../components/dashboard/GenderRatioBarChart";
import AlertsBlock from "../components/dashboard/AlertsBlock";
import TodoStrip from "../components/dashboard/TodoStrip";
import PageHeader from "../components/shared/PageHeader";
import { useAuth } from "../hooks/useAuth";
import { useSiteScope } from "../lib/site-scope";
import { useNavCounts } from "../hooks/useNavCounts";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

const REFRESH_MS = 60_000;

export default function Dashboard() {
  const { user } = useAuth();
  const [siteId] = useSiteScope();
  const counts = useNavCounts();
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ["dashboard", "kpis", siteId],
    queryFn: () =>
      api
        .get<DashboardSummary>("/dashboard/kpis", { params: { siteId: siteId || undefined } })
        .then((r) => r.data),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={user ? `Bonjour ${user.firstName}` : "Tableau de bord"}
        description={today.charAt(0).toUpperCase() + today.slice(1)}
        help={
          <ContextHelp id="dashboard-admin" title="Tableau de bord">
            <GlossaryTerm term="Présence semaine">
              Taux de travailleurs pointés sur la période en cours.
            </GlossaryTerm>
            <GlossaryTerm term="Paiements en attente">
              Montant MVola non encore exporté pour la campagne active.
            </GlossaryTerm>
            <GlossaryTerm term="Non renseigné">
              MOC dont le sexe n&apos;a pas été saisi dans la fiche travailleur.
            </GlossaryTerm>
          </ContextHelp>
        }
        action={
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
        }
      />

      {isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
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
          <TodoStrip kpis={data.kpis} counts={counts} isAdmin={user?.role === "ADMIN"} />
          <KpiCards kpis={data.kpis} />
          <div className="grid gap-4 xl:grid-cols-2">
            <PresenceChart data={data.presenceLast7Days} />
            <WorkforceChart data={data.workforceTrend} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <GenderBreakdownChart data={data.genderBreakdown} />
            <GenderRatioBarChart
              title="Ratio hommes-femmes par site"
              data={data.genderBySite}
              emptyLabel="Aucune donnée de site."
            />
          </div>
          <GenderRatioBarChart
            title="Ratio hommes-femmes par équipe"
            data={data.genderByTeam}
            emptyLabel="Aucune donnée d'équipe."
          />
          <AlertsBlock alerts={data.alerts} />
        </>
      )}
    </div>
  );
}
