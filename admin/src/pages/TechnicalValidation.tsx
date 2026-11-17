import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { ClipboardCheck } from "lucide-react";
import { api } from "../lib/api";
import { useCan } from "../hooks/useCan";
import { recentWeeks, weekLabel } from "../lib/week-iso";
import { synthesisApi, type SynthesisRow, type SynthesisStatusGroup } from "../lib/synthesis";
import type { ActivitySubActivity, Site } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Combobox } from "../components/ui/combobox";
import LotDetailDrawer from "../components/pointages/LotDetailDrawer";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import FilterChips from "../components/ui/FilterChips";
import { EmptyState } from "../components/ui/EmptyState";
import { TableQueryError } from "../components/ui/QueryError";
import { TableRowsSkeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { fetchAllCursorPages } from "../components/ui/data-table/fetchAllPages";
import { toast } from "../hooks/use-toast";

const WEEK_OPTIONS = recentWeeks(12);
const COLUMN_COUNT = 10;

function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

function rowKey(row: SynthesisRow): string {
  return `${row.weekIso}|${row.siteId}|${row.subActivityId}`;
}

export default function TechnicalValidationPage() {
  const can = useCan();
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState("");
  const [weekFrom, setWeekFrom] = useState(WEEK_OPTIONS[3]);
  const [weekTo, setWeekTo] = useState(WEEK_OPTIONS[0]);
  const [subActivityId, setSubActivityId] = useState("");
  const [status, setStatus] = useState<SynthesisStatusGroup>("TO_VALIDATE");
  const [categoryId, setCategoryId] = useState("");
  const [pending, setPending] = useState<SynthesisRow | null>(null);
  const [detail, setDetail] = useState<SynthesisRow | null>(null);

  const canValidate = can("pointage:valider_technique");

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const { data: subActivities = [] } = useQuery({
    queryKey: ["sub-activities", "all"],
    queryFn: () =>
      fetchAllCursorPages<ActivitySubActivity>((cursor) =>
        api
          .get<{ data: ActivitySubActivity[]; nextCursor: string | null; hasMore: boolean }>(
            "/sub-activities",
            { params: { cursor, take: 100 } },
          )
          .then((r) => r.data),
      ),
  });

  const synthesisQuery = useInfiniteQuery({
    queryKey: ["synthesis", siteId, weekFrom, weekTo, subActivityId, categoryId, status],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      synthesisApi.get({
        weekFrom,
        weekTo,
        siteId: siteId || undefined,
        subActivityId: subActivityId || undefined,
        categoryId: categoryId || undefined,
        group: status,
        offset: pageParam,
      }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  const { isLoading, isError, refetch } = synthesisQuery;

  const firstPage = synthesisQuery.data?.pages[0];
  const rows = useMemo(
    () => synthesisQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [synthesisQuery.data],
  );
  const statusCounts = firstPage?.counts ?? {
    TO_VALIDATE: 0,
    PENDING_SITE: 0,
    VALIDATED: 0,
    ALL: 0,
  };
  const totals = firstPage?.totals ?? {
    cost: 0,
    pendingSite: 0,
    toValidate: 0,
    validatedTechnical: 0,
  };
  const categories = firstPage?.categories ?? [];

  const validateMutation = useMutation({
    mutationFn: (row: SynthesisRow) =>
      synthesisApi.validateTechnical({
        weekIso: row.weekIso,
        siteId: row.siteId,
        subActivityId: row.subActivityId,
      }),
    onSuccess: (res) => {
      toast({
        title: "Validation technique enregistrée",
        description: `${res.validated} pointage(s) validé(s)`,
      });
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["synthesis"] });
    },
    onError: (err) => {
      toast({
        title: "Validation impossible",
        description: isAxiosError(err) ? String(err.response?.data?.message ?? "Erreur") : "Erreur",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Validation technique"
        description="Synthèse par semaine, site et activité. Seuls les pointages validés ici entrent dans les bordereaux."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="vt-from" className="mr-2">
            Du
          </Label>
          <Select
            id="vt-from"
            value={weekFrom}
            onChange={(event) => {
              setWeekFrom(event.target.value);
              if (event.target.value > weekTo) setWeekTo(event.target.value);
            }}
          >
            {[...WEEK_OPTIONS].reverse().map((week) => (
              <option key={week} value={week}>
                {weekLabel(week)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="vt-to" className="mr-2">
            Au
          </Label>
          <Select
            id="vt-to"
            value={weekTo}
            onChange={(event) => {
              setWeekTo(event.target.value);
              if (event.target.value < weekFrom) setWeekFrom(event.target.value);
            }}
          >
            {[...WEEK_OPTIONS].reverse().map((week) => (
              <option key={week} value={week}>
                {weekLabel(week)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="vt-site">Site</Label>
          <Combobox
            id="vt-site"
            placeholder="Rechercher un site…"
            options={[
              { value: "", label: "Tous les sites" },
              ...sites
                .filter((site) => site.active || site.id === siteId)
                .map((site) => ({ value: site.id, label: `${site.name} (${site.shortCode})` })),
            ]}
            value={siteId}
            onChange={setSiteId}
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vt-activity">Sous-activité</Label>
          <Combobox
            id="vt-activity"
            placeholder="Rechercher une sous-activité…"
            options={[
              { value: "", label: "Toutes les sous-activités" },
              ...subActivities.map((activity) => ({ value: activity.id, label: activity.label })),
            ]}
            value={subActivityId}
            onChange={setSubActivityId}
            className="w-64"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterChips
          label="Statut des lots"
          value={status}
          onChange={setStatus}
          options={[
            { value: "TO_VALIDATE", label: `À valider (${statusCounts.TO_VALIDATE})` },
            { value: "PENDING_SITE", label: `En attente du site (${statusCounts.PENDING_SITE})` },
            { value: "VALIDATED", label: `Déjà validés (${statusCounts.VALIDATED})` },
            { value: "ALL", label: `Tous (${statusCounts.ALL})` },
          ]}
        />
        <div className="space-y-1">
          <Label htmlFor="vt-category">Activité</Label>
          <Select
            id="vt-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Toutes les activités</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="warning">{formatNumber(totals.pendingSite)} en attente du site</Badge>
        <Badge variant="info">{formatNumber(totals.toValidate)} à valider</Badge>
        <Badge variant="success">{formatNumber(totals.validatedTechnical)} validés</Badge>
        <Badge variant="brand">Coût : {formatNumber(totals.cost)} Ar</Badge>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semaine</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Sous-activité</TableHead>
              <TableHead className="text-right">Personnes</TableHead>
              <TableHead className="text-right">Travaux</TableHead>
              <TableHead className="text-right">Coût (Ar)</TableHead>
              <TableHead className="text-right">En attente site</TableHead>
              <TableHead className="text-right">À valider</TableHead>
              <TableHead className="text-right">Validés</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRowsSkeleton rows={6} cols={COLUMN_COUNT} />
            ) : isError ? (
              <TableQueryError
                colSpan={COLUMN_COUNT}
                what="la synthèse"
                onRetry={() => void refetch()}
              />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="p-0">
                  <EmptyState
                    icon={ClipboardCheck}
                    title={
                      statusCounts.ALL === 0
                        ? "Aucun pointage sur cette période"
                        : "Aucun lot ne correspond à ce filtre"
                    }
                    hint={
                      statusCounts.ALL === 0
                        ? "Élargissez les semaines ou changez de sous-activité."
                        : "Choisissez un autre statut, par exemple « Tous »."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  <TableCell className="whitespace-nowrap">{weekLabel(row.weekIso)}</TableCell>
                  <TableCell>{row.siteName}</TableCell>
                  <TableCell>
                    <div className="font-medium text-zinc-900">{row.activityLabel}</div>
                    <div className="text-xs text-muted">{row.categoryLabel}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(row.people)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {formatNumber(row.quantity, 2)} {row.unit}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(row.cost)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.pendingSite)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.toValidate)}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(row.validatedTechnical)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetail(row)}>
                        Détail
                      </Button>
                      <div className="flex w-40 justify-start">
                        {canValidate && row.toValidate > 0 ? (
                          <Button size="sm" onClick={() => setPending(row)}>
                            Valider ({formatNumber(row.toValidate)})
                          </Button>
                        ) : row.toValidate === 0 && row.validatedTechnical > 0 ? (
                          <Badge variant="success" dot>
                            Validé
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMoreButton
        hasMore={!!synthesisQuery.hasNextPage}
        loading={synthesisQuery.isFetchingNextPage}
        onClick={() => void synthesisQuery.fetchNextPage()}
      />

      <LotDetailDrawer
        lot={detail}
        onClose={() => setDetail(null)}
        onValidate={(lot) => {
          setDetail(null);
          setPending(lot);
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        title="Valider techniquement ces pointages ?"
        description={
          pending
            ? `${pending.toValidate} pointage(s) — ${pending.activityLabel}, ${pending.siteName}, ${weekLabel(pending.weekIso)}. Ils pourront ensuite entrer dans les bordereaux.`
            : ""
        }
        confirmLabel="Valider"
        busy={validateMutation.isPending}
        onConfirm={() => pending && validateMutation.mutate(pending)}
        onOpenChange={(open) => !open && setPending(null)}
      />
    </div>
  );
}
