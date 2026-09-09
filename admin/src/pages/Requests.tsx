import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import PageHeader from "../components/shared/PageHeader";
import RequestDetailDrawer, {
  type RequestSelection,
} from "../components/requests/RequestDetailDrawer";
import { Badge } from "../components/ui/badge";
import { Eye, Check, X as XIcon, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import { IconButton } from "../components/ui/IconButton";
import { Checkbox } from "../components/ui/checkbox";
import { useRowSelection } from "../components/ui/data-table/useRowSelection";
import { useClientSort } from "../components/ui/data-table/useClientSort";
import { SortableHead } from "../components/ui/data-table/SortableHead";
import { BulkActionBar } from "../components/ui/data-table/BulkActionBar";
import { exportToExcel } from "../components/ui/data-table/exportToExcel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "../hooks/use-toast";
import { formatDate } from "../lib/referentials";
import {
  CLARIFICATION_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  type ActivityRequestRow,
  type ClarificationRequestRow,
  type ClarificationStatus,
  type RequestStatus,
  type RequestTab,
  type WorkerRequestRow,
  clarificationStatusVariant,
  fetchActivityRequests,
  fetchClarificationRequests,
  fetchWorkerRequests,
  requestStatusVariant,
  sortByOldest,
} from "../lib/workflows";

const TABS: { id: RequestTab; label: string }[] = [
  { id: "activities", label: "Activités" },
  { id: "workers", label: "Travailleurs" },
  { id: "clarifications", label: "Précisions" },
];

/** Onglets avec une décision d'admin en lot possible (approuver/rejeter). Précisions = workflow réponse/clôture, pas une décision. */
const BULK_DECISION_TABS = new Set<RequestTab>(["activities", "workers"]);

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<RequestTab>("activities");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ClarificationStatus | "">(
    "PENDING",
  );
  const [selection, setSelection] = useState<RequestSelection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activityQuery = useQuery({
    queryKey: ["activity-requests", statusFilter],
    enabled: tab === "activities",
    queryFn: () =>
      fetchActivityRequests(
        tab === "activities" && statusFilter ? (statusFilter as RequestStatus) : undefined,
      ),
  });

  const workerQuery = useQuery({
    queryKey: ["worker-requests", statusFilter],
    enabled: tab === "workers",
    queryFn: () =>
      fetchWorkerRequests(
        tab === "workers" && statusFilter ? (statusFilter as RequestStatus) : undefined,
      ),
  });

  const clarificationQuery = useQuery({
    queryKey: ["clarification-requests", statusFilter],
    enabled: tab === "clarifications",
    queryFn: () =>
      fetchClarificationRequests(
        tab === "clarifications" && statusFilter
          ? (statusFilter as ClarificationStatus)
          : undefined,
      ),
  });

  const activityRows = useMemo(
    () => sortByOldest(activityQuery.data ?? []),
    [activityQuery.data],
  );
  const workerRows = useMemo(() => sortByOldest(workerQuery.data ?? []), [workerQuery.data]);
  const clarificationRows = useMemo(
    () => sortByOldest(clarificationQuery.data ?? []),
    [clarificationQuery.data],
  );

  const activitySort = useClientSort<ActivityRequestRow>(activityRows, "createdAt");
  const workerSort = useClientSort<WorkerRequestRow>(workerRows, "createdAt");
  const clarificationSort = useClientSort<ClarificationRequestRow>(clarificationRows, "createdAt");

  const activitySelection = useRowSelection(activitySort.sorted.map((r) => r.id));
  const workerSelection = useRowSelection(workerSort.sorted.map((r) => r.id));

  const loading =
    (tab === "activities" && activityQuery.isLoading) ||
    (tab === "workers" && workerQuery.isLoading) ||
    (tab === "clarifications" && clarificationQuery.isLoading);

  const bulkDecisionMutation = useMutation({
    mutationFn: ({
      endpoint,
      ids,
      decision,
    }: {
      endpoint: string;
      ids: string[];
      decision: "APPROVED" | "REJECTED";
    }) =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(endpoint, {
        ids,
        decision,
        decisionReason: decision === "REJECTED" ? "Rejet en lot" : undefined,
      }),
    onSuccess: (res, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [variables.endpoint.includes("activity") ? "activity-requests" : "worker-requests"],
      });
      const failed = res.data.results.filter((r) => r.status === "error");
      activitySelection.clear();
      workerSelection.clear();
      toast({
        title: failed.length
          ? `${res.data.results.length - failed.length} traité(s), ${failed.length} échec(s)`
          : "Décisions appliquées",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  function bulkDecide(decision: "APPROVED" | "REJECTED") {
    if (tab === "activities") {
      bulkDecisionMutation.mutate({
        endpoint: "/activity-requests/bulk-decision",
        ids: [...activitySelection.selectedIds],
        decision,
      });
    } else if (tab === "workers") {
      bulkDecisionMutation.mutate({
        endpoint: "/worker-requests/bulk-decision",
        ids: [...workerSelection.selectedIds],
        decision,
      });
    }
  }

  function openSelection(next: RequestSelection) {
    setSelection(next);
    setDrawerOpen(true);
  }

  function handleTabChange(nextTab: RequestTab) {
    setTab(nextTab);
    setStatusFilter(nextTab === "clarifications" ? "OPEN" : "PENDING");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") {
        return;
      }
      if (event.key === "1") handleTabChange("activities");
      if (event.key === "2") handleTabChange("workers");
      if (event.key === "3") handleTabChange("clarifications");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function refreshCurrentTab() {
    if (tab === "activities") void activityQuery.refetch();
    if (tab === "workers") void workerQuery.refetch();
    if (tab === "clarifications") void clarificationQuery.refetch();
  }

  function handleExport() {
    if (tab === "activities") {
      void exportToExcel<ActivityRequestRow>(
        activitySort.sorted,
        [
          { header: "Date", accessor: (r) => formatDate(r.createdAt) },
          { header: "Libellé", accessor: (r) => r.proposedLabel },
          { header: "Tarif", accessor: (r) => Number(r.proposedRate) },
          { header: "Unité", accessor: (r) => r.proposedUnit },
          { header: "Statut", accessor: (r) => REQUEST_STATUS_LABELS[r.status] },
        ],
        "demandes-activites",
      );
    } else if (tab === "workers") {
      void exportToExcel<WorkerRequestRow>(
        workerSort.sorted,
        [
          { header: "Date", accessor: (r) => formatDate(r.createdAt) },
          { header: "Prénom", accessor: (r) => r.firstName },
          { header: "Nom", accessor: (r) => r.lastName },
          { header: "MVola", accessor: (r) => r.mvolaNumber },
          { header: "Statut", accessor: (r) => REQUEST_STATUS_LABELS[r.status] },
        ],
        "demandes-travailleurs",
      );
    } else {
      void exportToExcel<ClarificationRequestRow>(
        clarificationSort.sorted,
        [
          { header: "Date", accessor: (r) => formatDate(r.createdAt) },
          { header: "Pointage", accessor: (r) => r.pointageId },
          { header: "Question", accessor: (r) => r.question },
          { header: "Statut", accessor: (r) => CLARIFICATION_STATUS_LABELS[r.status] },
        ],
        "demandes-precisions",
      );
    }
  }

  const activeSelection =
    tab === "activities" ? activitySelection : tab === "workers" ? workerSelection : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes terrain"
        description="File unifiée des demandes CDS — triées par ancienneté."
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" aria-hidden />
              Exporter
            </Button>
            <Button type="button" variant="outline" onClick={() => refreshCurrentTab()}>
              Actualiser
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTabChange(item.id)}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2",
              tab === item.id
                ? "border-b-2 border-zinc-900 font-medium text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900",
            )}
            title={`Raccourci ${index + 1}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {tab === "clarifications" ? (
          <select
            className="alterra-focus h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ClarificationStatus | "")
            }
          >
            <option value="">Tous statuts</option>
            {(Object.keys(CLARIFICATION_STATUS_LABELS) as ClarificationStatus[]).map((status) => (
              <option key={status} value={status}>
                {CLARIFICATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="alterra-focus h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as RequestStatus | "")}
          >
            <option value="">Tous statuts</option>
            {(Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[]).map((status) => (
              <option key={status} value={status}>
                {REQUEST_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        )}
      </div>

      {activeSelection && (
        <BulkActionBar count={activeSelection.selectedCount} onClear={activeSelection.clear}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bulkDecisionMutation.isPending}
            onClick={() => bulkDecide("APPROVED")}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Approuver
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bulkDecisionMutation.isPending}
            onClick={() => bulkDecide("REJECTED")}
          >
            <XIcon className="h-3.5 w-3.5" aria-hidden />
            Rejeter
          </Button>
        </BulkActionBar>
      )}

      {loading && <p className="text-sm text-zinc-600">Chargement…</p>}

      {tab === "activities" && !loading && (
        <RequestsTable
          emptyLabel="Aucune demande d'activité."
          rows={activitySort.sorted}
          selection={activitySelection}
          sort={activitySort}
          columns={[
            { key: "createdAt", label: "Date" },
            { key: "proposedLabel", label: "Libellé" },
            { key: "proposedRate", label: "Tarif" },
            { key: "status", label: "Statut" },
            null,
          ]}
          renderCells={(row: ActivityRequestRow) => (
            <>
              <TableCell className="text-sm">{formatDate(row.createdAt)}</TableCell>
              <TableCell className="text-sm font-medium">{row.proposedLabel}</TableCell>
              <TableCell className="text-sm">
                {Number(row.proposedRate).toLocaleString("fr-MG")} Ar / {row.proposedUnit}
              </TableCell>
              <TableCell>
                <Badge variant={requestStatusVariant(row.status)}>
                  {REQUEST_STATUS_LABELS[row.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <IconButton
                  icon={Eye}
                  label="Voir le détail"
                  variant="brand"
                  onClick={() => openSelection({ type: "activity", row })}
                />
              </TableCell>
            </>
          )}
        />
      )}

      {tab === "workers" && !loading && (
        <RequestsTable
          emptyLabel="Aucune demande MOC."
          rows={workerSort.sorted}
          selection={workerSelection}
          sort={workerSort}
          columns={[
            { key: "createdAt", label: "Date" },
            { key: "lastName", label: "Identité" },
            { key: "mvolaNumber", label: "MVola" },
            { key: "status", label: "Statut" },
            null,
          ]}
          renderCells={(row: WorkerRequestRow) => (
            <>
              <TableCell className="text-sm">{formatDate(row.createdAt)}</TableCell>
              <TableCell className="text-sm font-medium">
                {row.firstName} {row.lastName}
              </TableCell>
              <TableCell className="text-sm">{row.mvolaNumber}</TableCell>
              <TableCell>
                <Badge variant={requestStatusVariant(row.status)}>
                  {REQUEST_STATUS_LABELS[row.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <IconButton
                  icon={Eye}
                  label="Voir le détail"
                  variant="brand"
                  onClick={() => openSelection({ type: "worker", row })}
                />
              </TableCell>
            </>
          )}
        />
      )}

      {tab === "clarifications" && !loading && (
        <RequestsTable
          emptyLabel="Aucune demande de précisions."
          rows={clarificationSort.sorted}
          selection={null}
          sort={clarificationSort}
          columns={[
            { key: "createdAt", label: "Date" },
            { key: "pointageId", label: "Pointage" },
            { key: "question", label: "Question" },
            { key: "status", label: "Statut" },
            null,
          ]}
          renderCells={(row: ClarificationRequestRow) => (
            <>
              <TableCell className="text-sm">{formatDate(row.createdAt)}</TableCell>
              <TableCell className="font-mono text-xs">{row.pointageId.slice(0, 8)}</TableCell>
              <TableCell className="max-w-xs truncate text-sm">{row.question}</TableCell>
              <TableCell>
                <Badge variant={clarificationStatusVariant(row.status)}>
                  {CLARIFICATION_STATUS_LABELS[row.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <IconButton
                  icon={Eye}
                  label="Voir le détail"
                  variant="brand"
                  onClick={() => openSelection({ type: "clarification", row })}
                />
              </TableCell>
            </>
          )}
        />
      )}

      <RequestDetailDrawer
        selection={selection}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdated={refreshCurrentTab}
      />
    </div>
  );
}

interface RequestsTableColumn {
  key: string;
  label: string;
}

function RequestsTable<T extends { id: string }>({
  rows,
  columns,
  columnLabelsOverride,
  emptyLabel,
  renderCells,
  selection,
  sort,
}: {
  rows: T[];
  columns: (RequestsTableColumn | null)[];
  columnLabelsOverride?: string[];
  emptyLabel: string;
  renderCells: (row: T) => React.ReactNode;
  selection: ReturnType<typeof useRowSelection> | null;
  sort: { sortKey: string | null; sortDir: "asc" | "desc"; toggleSort: (key: string) => void };
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {selection && (
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
            )}
            {columns.map((column, index) =>
              column ? (
                <SortableHead
                  key={column.key}
                  sortKey={column.key}
                  label={column.label}
                  currentKey={sort.sortKey}
                  currentDir={sort.sortDir}
                  onSort={sort.toggleSort}
                />
              ) : (
                <TableHead key={`col-${index}`}>{columnLabelsOverride?.[index] ?? ""}</TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-state={selection?.isSelected(row.id) ? "selected" : undefined}>
              {selection && (
                <TableCell>
                  <Checkbox
                    checked={selection.isSelected(row.id)}
                    onChange={() => selection.toggle(row.id)}
                    aria-label="Sélectionner la ligne"
                  />
                </TableCell>
              )}
              {renderCells(row)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
