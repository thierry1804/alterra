import { useQuery } from "@tanstack/react-query";
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
import PageHeader from "../components/shared/PageHeader";
import BordereauDetailDrawer from "../components/payments/BordereauDetailDrawer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Combobox } from "../components/ui/combobox";
import { EmptyState } from "../components/ui/EmptyState";
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

export default function BordereauxPage() {
  const [periodIso, setPeriodIso] = useState(currentIsoWeekInput());
  const [siteId, setSiteId] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const listPeriod = useMemo(() => periodToExportParam(periodIso), [periodIso]);
  const referenceYear = periodIso.match(/^(\d{4})-W/)?.[1];

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bordereaux", listPeriod, referenceYear, siteId],
    queryFn: () =>
      api
        .get<{ data: BordereauRow[] }>("/bordereaux", {
          params: { periodIso: listPeriod, referenceYear, siteId: siteId || undefined },
        })
        .then((r) => r.data.data),
    enabled: !!listPeriod,
    refetchInterval: 15000,
  });

  const rows = useMemo(
    () => (data ?? []).filter((row) => !status || row.status === status),
    [data, status],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bordereaux"
        description="Un bordereau par site. La finance valide en premier, puis le DG : après la deuxième validation, rien ne change plus."
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="space-y-1">
          <Label htmlFor="bd-period">Période (semaine)</Label>
          <Input
            id="bd-period"
            type="week"
            value={periodIso}
            onChange={(event) => event.target.value && setPeriodIso(event.target.value)}
            className="w-40"
          />
        </div>
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
        <div className="space-y-1">
          <Label htmlFor="bd-status">Statut</Label>
          <Select id="bd-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tous les statuts</option>
            {(["GENERATED", "FINANCE_VALIDATED", "DG_VALIDATED", "EXPORTED"] as const).map(
              (value) => (
                <option key={value} value={value}>
                  {BORDEREAU_STATUS_LABELS[value]}
                </option>
              ),
            )}
          </Select>
        </div>
      </div>

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
                    title="Aucun bordereau pour cette période"
                    hint="Les bordereaux apparaissent une fois générés depuis la page Paiements."
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

      <BordereauDetailDrawer bordereauId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
