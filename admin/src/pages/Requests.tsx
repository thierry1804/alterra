import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils";
import PageHeader from "../components/shared/PageHeader";
import RequestDetailDrawer, {
  type RequestSelection,
} from "../components/requests/RequestDetailDrawer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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

export default function RequestsPage() {
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

  const loading =
    (tab === "activities" && activityQuery.isLoading) ||
    (tab === "workers" && workerQuery.isLoading) ||
    (tab === "clarifications" && clarificationQuery.isLoading);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes terrain"
        description="File unifiée des demandes CDS — triées par ancienneté."
        action={
          <Button type="button" variant="outline" onClick={() => refreshCurrentTab()}>
            Actualiser
          </Button>
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

      {loading && <p className="text-sm text-zinc-600">Chargement…</p>}

      {tab === "activities" && !loading && (
        <RequestsTable
          emptyLabel="Aucune demande d'activité."
          rows={activityRows}
          columns={["Date", "Libellé", "Tarif", "Statut", ""]}
          renderRow={(row: ActivityRequestRow) => (
            <TableRow key={row.id}>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openSelection({ type: "activity", row })}
                >
                  Détail
                </Button>
              </TableCell>
            </TableRow>
          )}
        />
      )}

      {tab === "workers" && !loading && (
        <RequestsTable
          emptyLabel="Aucune demande MOC."
          rows={workerRows}
          columns={["Date", "Identité", "MVola", "Statut", ""]}
          renderRow={(row: WorkerRequestRow) => (
            <TableRow key={row.id}>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openSelection({ type: "worker", row })}
                >
                  Détail
                </Button>
              </TableCell>
            </TableRow>
          )}
        />
      )}

      {tab === "clarifications" && !loading && (
        <RequestsTable
          emptyLabel="Aucune demande de précisions."
          rows={clarificationRows}
          columns={["Date", "Pointage", "Question", "Statut", ""]}
          renderRow={(row: ClarificationRequestRow) => (
            <TableRow key={row.id}>
              <TableCell className="text-sm">{formatDate(row.createdAt)}</TableCell>
              <TableCell className="font-mono text-xs">{row.pointageId.slice(0, 8)}</TableCell>
              <TableCell className="max-w-xs truncate text-sm">{row.question}</TableCell>
              <TableCell>
                <Badge variant={clarificationStatusVariant(row.status)}>
                  {CLARIFICATION_STATUS_LABELS[row.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openSelection({ type: "clarification", row })}
                >
                  Détail
                </Button>
              </TableCell>
            </TableRow>
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

function RequestsTable<T>({
  rows,
  columns,
  emptyLabel,
  renderRow,
}: {
  rows: T[];
  columns: string[];
  emptyLabel: string;
  renderRow: (row: T) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows.map((row) => renderRow(row))}</TableBody>
      </Table>
    </div>
  );
}
