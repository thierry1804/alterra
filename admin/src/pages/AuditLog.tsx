import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
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
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-log", page, action, entityType, dateFrom, dateTo],
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
          },
        })
        .then((r) => r.data),
    placeholderData: (previous) => previous,
  });

  const rows = data?.data ?? [];

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
      />

      <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 md:grid-cols-5">
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
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="w-24">Détail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-zinc-600">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-zinc-600">
                  Aucune entrée pour ces filtres.
                </TableCell>
              </TableRow>
            )}
            {rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{formatAuditDate(entry.createdAt)}</TableCell>
                <TableCell>{auditActorLabel(entry)}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell>{entry.entityType}</TableCell>
                <TableCell className="font-mono text-xs">{entry.entityId ?? "—"}</TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEntry(entry)}>
                    Voir
                  </Button>
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

      <AuditDetailDrawer
        entry={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
