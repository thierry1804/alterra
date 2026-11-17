import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileCheck } from "lucide-react";
import { api } from "../lib/api";
import {
  BORDEREAU_STATUS_LABELS,
  bordereauStatusVariant,
  currentIsoWeekInput,
  periodToExportParam,
  type BordereauRow,
} from "../lib/payments";
import type { Site } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import BordereauDetailDrawer from "../components/payments/BordereauDetailDrawer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Combobox } from "../components/ui/combobox";
import { EmptyState } from "../components/ui/EmptyState";
import FilterChips from "../components/ui/FilterChips";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
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

const COLUMN_COUNT = 8;

type StatusFilter = "TO_VALIDATE" | "TO_EXPORT" | "EXPORTED" | "ALL";

interface BordereauxPage {
  data: BordereauRow[];
  nextCursor: string | null;
  hasMore: boolean;
  counts: Record<StatusFilter, number>;
}

export default function BordereauxPage() {
  const [periodIso, setPeriodIso] = useState(currentIsoWeekInput());
  const [siteId, setSiteId] = useState("");
  const [allPeriods, setAllPeriods] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("TO_VALIDATE");
  const [openId, setOpenId] = useState<string | null>(null);

  const listPeriod = useMemo(() => periodToExportParam(periodIso), [periodIso]);
  const referenceYear = periodIso.match(/^(\d{4})-W/)?.[1];

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const bordereauxQuery = useInfiniteQuery({
    queryKey: [
      "bordereaux",
      allPeriods ? "all" : listPeriod,
      allPeriods ? "" : referenceYear,
      siteId,
      status,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<BordereauxPage>("/bordereaux", {
          params: {
            periodIso: allPeriods ? undefined : listPeriod,
            referenceYear: allPeriods ? undefined : referenceYear,
            siteId: siteId || undefined,
            group: status,
            cursor: pageParam,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    enabled: allPeriods || !!listPeriod,
    refetchInterval: 15000,
  });
  const { isLoading, isError, refetch } = bordereauxQuery;

  const rows = useMemo(
    () => bordereauxQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [bordereauxQuery.data],
  );
  const statusCounts: Record<StatusFilter, number> = bordereauxQuery.data?.pages[0]?.counts ?? {
    TO_VALIDATE: 0,
    TO_EXPORT: 0,
    EXPORTED: 0,
    ALL: 0,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bordereaux"
        description="Un bordereau par site. La finance valide en premier, puis le DG : après la deuxième validation, rien ne change plus."
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="space-y-1">
          <Label htmlFor="bd-period-mode">Période</Label>
          <Select
            id="bd-period-mode"
            value={allPeriods ? "ALL" : "WEEK"}
            onChange={(event) => setAllPeriods(event.target.value === "ALL")}
          >
            <option value="ALL">Toutes les semaines</option>
            <option value="WEEK">Une semaine</option>
          </Select>
        </div>
        {!allPeriods && (
          <div className="space-y-1">
            <Label htmlFor="bd-period">Semaine</Label>
            <Input
              id="bd-period"
              type="week"
              value={periodIso}
              onChange={(event) => event.target.value && setPeriodIso(event.target.value)}
              className="w-40"
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="bd-site">Site</Label>
          <Combobox
            id="bd-site"
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
      </div>

      <FilterChips
        label="Statut des bordereaux"
        value={status}
        onChange={setStatus}
        options={[
          { value: "TO_VALIDATE", label: `À valider (${statusCounts.TO_VALIDATE})` },
          { value: "TO_EXPORT", label: `Validés DG, à exporter (${statusCounts.TO_EXPORT})` },
          { value: "EXPORTED", label: `Exportés (${statusCounts.EXPORTED})` },
          { value: "ALL", label: `Tous (${statusCounts.ALL})` },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Période</TableHead>
              <TableHead className="text-right">N°</TableHead>
              <TableHead className="text-right">Version</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Paiements</TableHead>
              <TableHead className="text-right">Montant brut (Ar)</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRowsSkeleton rows={4} cols={COLUMN_COUNT} />
            ) : isError ? (
              <TableQueryError
                colSpan={COLUMN_COUNT}
                what="les bordereaux"
                onRetry={() => void refetch()}
              />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="p-0">
                  <EmptyState
                    icon={FileCheck}
                    title={
                      statusCounts.ALL === 0
                        ? "Aucun bordereau pour cette sélection"
                        : "Aucun bordereau ne correspond à ce statut"
                    }
                    hint={
                      statusCounts.ALL === 0
                        ? "Les bordereaux apparaissent une fois générés depuis la page Paiements."
                        : "Choisissez un autre statut, par exemple « Tous »."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.siteName} ({row.siteCode})
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.periodIso} {row.referenceYear}
                  </TableCell>
                  <TableCell className="text-right">{row.number}</TableCell>
                  <TableCell className="text-right">{row.version}</TableCell>
                  <TableCell>
                    <Badge variant={bordereauStatusVariant(row.status)}>
                      {BORDEREAU_STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.paymentCount}</TableCell>
                  <TableCell className="text-right">
                    {Number(row.totalAmount).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button size="sm" variant="outline" onClick={() => setOpenId(row.id)}>
                      Ouvrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMoreButton
        hasMore={!!bordereauxQuery.hasNextPage}
        loading={bordereauxQuery.isFetchingNextPage}
        onClick={() => void bordereauxQuery.fetchNextPage()}
      />

      <BordereauDetailDrawer bordereauId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
