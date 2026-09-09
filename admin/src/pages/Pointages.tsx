import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Camera, ClipboardList, Eye, Check, X as XIcon, Download } from "lucide-react";
import { api } from "../lib/api";
import type { Pointage, PointageStatus } from "../lib/pointages";
import {
  POINTAGE_STATUS_LABELS,
  formatPointageAmount,
  pointageStatusVariant,
} from "../lib/pointages";
import type { Activity, Worker } from "../lib/referentials";
import { formatDate } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import PointageDetailDrawer from "../components/pointages/PointageDetailDrawer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { EmptyState } from "../components/ui/EmptyState";
import { TableRowsSkeleton } from "../components/ui/skeleton";
import { Checkbox } from "../components/ui/checkbox";
import { useRowSelection } from "../components/ui/data-table/useRowSelection";
import { useServerSort } from "../components/ui/data-table/useServerSort";
import { SortableHead } from "../components/ui/data-table/SortableHead";
import { BulkActionBar } from "../components/ui/data-table/BulkActionBar";
import { exportToExcel } from "../components/ui/data-table/exportToExcel";
import { fetchAllCursorPages } from "../components/ui/data-table/fetchAllPages";
import { toast } from "../hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export default function PointagesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PointageStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Pointage | null>(null);

  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<{ data: Activity[] }>("/activities").then((r) => r.data.data),
  });

  const { sortKey, sortDir, toggleSort } = useServerSort(null);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

  const pointagesQuery = useInfiniteQuery({
    queryKey: ["pointages", statusFilter, dateFrom, dateTo, sortKey, sortDir],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: Pointage[]; nextCursor: string | null; hasMore: boolean }>("/pointages", {
          params: {
            status: statusFilter || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            cursor: pageParam,
            orderBy: sortKey ?? undefined,
            dir: sortKey ? sortDir : undefined,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor ?? undefined : undefined),
  });

  const pointages = useMemo(
    () => pointagesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [pointagesQuery.data],
  );

  const selection = useRowSelection(pointages.map((p) => p.id));

  function invalidateAfterBulk(res: { data: { results: Array<{ id: string; status: string; error?: string }> } }) {
    void queryClient.invalidateQueries({ queryKey: ["pointages"] });
    const failed = res.data.results.filter((r) => r.status === "error");
    selection.clear();
    toast({
      title: failed.length
        ? `${res.data.results.length - failed.length} traité(s), ${failed.length} échec(s)`
        : "Pointages mis à jour",
      description: failed[0]?.error,
      variant: failed.length ? "destructive" : undefined,
    });
  }

  const bulkValidateMutation = useMutation({
    mutationFn: () =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/pointages/bulk-validate",
        { ids: [...selection.selectedIds] },
      ),
    onSuccess: invalidateAfterBulk,
  });

  const bulkRejectMutation = useMutation({
    mutationFn: () =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/pointages/bulk-reject",
        { ids: [...selection.selectedIds], rejectionReason: bulkRejectReason.trim() },
      ),
    onSuccess: (res) => {
      setBulkRejectReason("");
      invalidateAfterBulk(res);
    },
  });

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const all = await fetchAllCursorPages<Pointage>((cursor) =>
        api
          .get<{ data: Pointage[]; nextCursor: string | null; hasMore: boolean }>("/pointages", {
            params: {
              status: statusFilter || undefined,
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
              cursor,
            },
          })
          .then((r) => r.data),
      );
      await exportToExcel(
        all,
        [
          { header: "Date", accessor: (p) => formatDate(p.date) },
          { header: "MOC", accessor: (p) => workerLabel(p.workerId) },
          { header: "Activité", accessor: (p) => activityLabel(p.activityId) },
          { header: "Quantité", accessor: (p) => Number(p.quantity) },
          { header: "Montant (Ar)", accessor: (p) => Number(p.amount) },
          { header: "Statut", accessor: (p) => POINTAGE_STATUS_LABELS[p.status] },
        ],
        "pointages",
      );
    } finally {
      setExporting(false);
    }
  }

  const workerIds = useMemo(() => [...new Set(pointages.map((p) => p.workerId))], [pointages]);

  const workerQueries = useQueries({
    queries: workerIds.map((id) => ({
      queryKey: ["worker", id],
      queryFn: () => api.get<Worker>(`/workers/${id}`).then((r) => r.data),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const workersMap = useMemo(() => {
    const map = new Map<string, Worker>();
    workerQueries.forEach((query, index) => {
      if (query.data) map.set(workerIds[index], query.data);
    });
    return map;
  }, [workerQueries, workerIds]);

  const activitiesMap = useMemo(() => {
    const map = new Map<string, Activity>();
    activities.forEach((activity) => map.set(activity.id, activity));
    return map;
  }, [activities]);

  const selectedWorker = selected ? workersMap.get(selected.workerId) ?? null : null;
  const selectedActivity = selected ? activitiesMap.get(selected.activityId) ?? null : null;

  function workerLabel(workerId: string): string {
    const worker = workersMap.get(workerId);
    return worker ? `${worker.firstName} ${worker.lastName}` : workerId.slice(0, 8);
  }

  function activityLabel(activityId: string): string {
    return activitiesMap.get(activityId)?.label ?? activityId.slice(0, 8);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pointages"
        description="Validation et suivi des saisies terrain."
        action={
          <Button type="button" variant="outline" disabled={exporting} onClick={() => void handleExport()}>
            <Download className="h-4 w-4" aria-hidden />
            {exporting ? "Export…" : "Exporter"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Statut</span>
          <Select
            className="w-48"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PointageStatus | "")}
            aria-label="Filtrer par statut"
          >
            <option value="">Tous statuts</option>
            {(Object.keys(POINTAGE_STATUS_LABELS) as PointageStatus[]).map((status) => (
              <option key={status} value={status}>
                {POINTAGE_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Du</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
            aria-label="Date début"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Au</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
            aria-label="Date fin"
          />
        </label>
        {(statusFilter || dateFrom || dateTo) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Réinitialiser
          </Button>
        )}
      </div>

      <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bulkValidateMutation.isPending}
          onClick={() => bulkValidateMutation.mutate()}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          Valider
        </Button>
        <Input
          placeholder="Motif de rejet"
          value={bulkRejectReason}
          onChange={(e) => setBulkRejectReason(e.target.value)}
          className="h-8 w-48 text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bulkRejectMutation.isPending || bulkRejectReason.trim().length < 3}
          onClick={() => bulkRejectMutation.mutate()}
        >
          <XIcon className="h-3.5 w-3.5" aria-hidden />
          Rejeter
        </Button>
      </BulkActionBar>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">
                <Checkbox
                  checked={
                    selection.allVisibleSelected
                      ? true
                      : selection.someVisibleSelected
                        ? "indeterminate"
                        : false
                  }
                  onChange={selection.toggleAllVisible}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <TableHead className="w-12" />
              <SortableHead sortKey="date" label="Date" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <TableHead>MOC</TableHead>
              <TableHead>Activité</TableHead>
              <SortableHead sortKey="quantity" label="Qté" numeric currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="amount" label="Montant" numeric currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <TableHead>Bio</TableHead>
              <SortableHead sortKey="status" label="Statut" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pointagesQuery.isLoading && <TableRowsSkeleton rows={8} cols={10} />}
            {!pointagesQuery.isLoading &&
              pointages.map((pointage) => (
                <TableRow key={pointage.id} data-state={selection.isSelected(pointage.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selection.isSelected(pointage.id)}
                      onChange={() => selection.toggle(pointage.id)}
                      aria-label="Sélectionner ce pointage"
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded border ${
                        pointage.photoKey
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                      title={pointage.photoKey ? "Photo disponible" : "Sans photo"}
                    >
                      <Camera
                        className={`h-3.5 w-3.5 ${
                          pointage.photoKey ? "text-emerald-700" : "text-zinc-400"
                        }`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono tabular-nums text-zinc-600">
                    {formatDate(pointage.date)}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-900">
                    {workerLabel(pointage.workerId)}
                  </TableCell>
                  <TableCell className="text-zinc-600">{activityLabel(pointage.activityId)}</TableCell>
                  <TableCell numeric>{pointage.quantity}</TableCell>
                  <TableCell numeric className="font-medium text-zinc-900">
                    {formatPointageAmount(pointage.amount)}
                  </TableCell>
                  <TableCell>
                    {pointage.bioCheck ? (
                      <Badge
                        variant={pointage.bioCheck.result === "OK" ? "success" : "warning"}
                      >
                        {pointage.bioCheck.result}
                      </Badge>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pointageStatusVariant(pointage.status)}>
                      {POINTAGE_STATUS_LABELS[pointage.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions>
                      <IconButton
                        icon={Eye}
                        label="Voir le détail"
                        variant="brand"
                        onClick={() => setSelected(pointage)}
                      />
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            {!pointagesQuery.isLoading && pointages.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10} className="p-0">
                  <EmptyState
                    icon={ClipboardList}
                    title="Aucun pointage pour ces filtres"
                    hint="Élargissez la période ou réinitialisez les filtres pour retrouver des saisies terrain."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMoreButton
        hasMore={!!pointagesQuery.hasNextPage}
        loading={pointagesQuery.isFetchingNextPage}
        onClick={() => void pointagesQuery.fetchNextPage()}
      />

      <PointageDetailDrawer
        pointage={selected}
        worker={selectedWorker}
        activity={selectedActivity}
        activities={activities}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onUpdated={() => void queryClient.invalidateQueries({ queryKey: ["pointages"] })}
      />
    </div>
  );
}
