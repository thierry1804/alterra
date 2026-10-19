import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { EmptyState } from "../components/ui/EmptyState";
import FilterChips from "../components/ui/FilterChips";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditLogEntry,
  type AuditLogResponse,
  auditActorLabel,
  formatAuditDate,
} from "../lib/audit";
import PageHeader from "../components/shared/PageHeader";
import AuditDetailDrawer from "../components/audit/AuditDetailDrawer";
import { Eye, Download, ScrollText } from "lucide-react";
import { Button } from "../components/ui/button";
import { IconButton } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useServerSort } from "../components/ui/data-table/useServerSort";
import { SortableHead } from "../components/ui/data-table/SortableHead";
import { exportToExcel } from "../components/ui/data-table/exportToExcel";
import { fetchAllOffsetPages } from "../components/ui/data-table/fetchAllPages";
import { useRowSelection } from "../components/ui/data-table/useRowSelection";
import { Checkbox } from "../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { TableQueryError } from "../components/ui/QueryError";

const QUICK_ACTIONS = [
  { value: "", label: "Toutes" },
  { value: "LOGIN", label: "Connexions" },
  { value: "VALIDATE", label: "Validations" },
  { value: "EXPORT", label: "Exports" },
  { value: "UPDATE", label: "Modifications" },
  { value: "RATE_CHANGE", label: "Tarifs" },
];

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { sortKey, sortDir, toggleSort } = useServerSort(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["audit-log", page, action, entityType, dateFrom, dateTo, sortKey, sortDir],
    queryFn: () =>
      api
        .get<AuditLogResponse>("/audit-log", {
          params: {
            page,
            limit: 50,
            action: action || undefined,
            entityType: entityType || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            orderBy: sortKey ?? undefined,
            dir: sortKey ? sortDir : undefined,
          },
        })
        .then((r) => r.data),
    placeholderData: (previous) => previous,
  });

  const rows = data?.data ?? [];
  const selection = useRowSelection(rows.map((r) => r.id));

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const rowsToExport =
        selection.selectedCount > 0
          ? rows.filter((r) => selection.isSelected(r.id))
          : await fetchAllOffsetPages<AuditLogEntry>((p) =>
              api
                .get<AuditLogResponse>("/audit-log", {
                  params: {
                    page: p,
                    limit: 100,
                    action: action || undefined,
                    entityType: entityType || undefined,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                  },
                })
                .then((r) => ({ data: r.data.data, hasMore: r.data.hasMore })),
            );
      await exportToExcel(
        rowsToExport,
        [
          { header: "Date", accessor: (e) => formatAuditDate(e.createdAt) },
          { header: "Utilisateur", accessor: (e) => auditActorLabel(e) },
          { header: "Action", accessor: (e) => e.action },
          { header: "Entité", accessor: (e) => e.entityType },
          { header: "ID", accessor: (e) => e.entityId ?? "" },
        ],
        "audit",
      );
    } finally {
      setExporting(false);
    }
  }

  function openEntry(entry: AuditLogEntry) {
    setSelected(entry);
    setDrawerOpen(true);
  }

  function resetFilters() {
    setAction("");
    setEntityType("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'audit"
        description="Actions sensibles tracées — consultation en lecture seule."
        action={
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden />
            {exporting ? "Export…" : "Exporter"}
          </Button>
        }
      />

      <FilterChips
        label="Actions fréquentes"
        value={QUICK_ACTIONS.some((item) => item.value === action) ? action : "__other__"}
        onChange={(value) => {
          setAction(value === "__other__" ? "" : value);
          setPage(1);
        }}
        options={[
          ...QUICK_ACTIONS,
          ...(action && !QUICK_ACTIONS.some((i) => i.value === action)
            ? [{ value: "__other__", label: action }]
            : []),
        ]}
      />

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="audit-action">Action</Label>
          <select
            id="audit-action"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="">Toutes</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-entity">Entité</Label>
          <select
            id="audit-entity"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="">Toutes</option>
            {AUDIT_ENTITY_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-from">Du</Label>
          <Input
            id="audit-from"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-to">Au</Label>
          <Input
            id="audit-to"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={resetFilters}>
            Réinitialiser
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
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
              <SortableHead
                sortKey="createdAt"
                label="Date"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="userId"
                label="Utilisateur"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="action"
                label="Action"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="entityType"
                label="Entité"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="entityId"
                label="ID"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <TableHead className="w-24">Détail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-zinc-600">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableQueryError
                colSpan={7}
                what="le journal d'audit"
                onRetry={() => void refetch()}
              />
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={ScrollText}
                    title="Aucune entrée pour ces filtres"
                    hint="Élargissez la période ou choisissez « Toutes » pour revoir l'ensemble des actions."
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((entry) => (
              <TableRow
                key={entry.id}
                data-state={selection.isSelected(entry.id) ? "selected" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selection.isSelected(entry.id)}
                    onChange={() => selection.toggle(entry.id)}
                    aria-label="Sélectionner cette entrée"
                  />
                </TableCell>
                <TableCell>{formatAuditDate(entry.createdAt)}</TableCell>
                <TableCell>{auditActorLabel(entry)}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell>{entry.entityType}</TableCell>
                <TableCell className="font-mono text-xs">{entry.entityId ?? "—"}</TableCell>
                <TableCell>
                  <IconButton
                    icon={Eye}
                    label="Voir le détail"
                    variant="brand"
                    onClick={() => openEntry(entry)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>
          Page {data?.page ?? page}
          {data?.total !== undefined ? ` · ${data.total} entrée(s)` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Précédent
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data?.hasMore || isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Suivant
          </Button>
        </div>
      </div>

      <AuditDetailDrawer entry={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
