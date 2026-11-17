import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Download, FileSpreadsheet } from "lucide-react";
import { api } from "../lib/api";
import { downloadBlob, filenameFromDisposition } from "../lib/download";
import { periodToExportParam, type ExportQueueRow } from "../lib/payments";
import { useCan } from "../hooks/useCan";
import { toast } from "../hooks/use-toast";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import MvolaImportDialog from "../components/payments/MvolaImportDialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import FilterChips from "../components/ui/FilterChips";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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

const COLUMN_COUNT = 9;

type QueueGroup = "TO_EXPORT" | "EXPORTED" | "ALL";

interface ExportQueuePage {
  data: ExportQueueRow[];
  nextCursor: string | null;
  hasMore: boolean;
  counts: Record<QueueGroup, number>;
}

function formatAr(value: string | number): string {
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function errorMessage(err: unknown): string {
  if (!isAxiosError(err)) return "Erreur";
  const blob = err.response?.data;
  return String(blob?.message ?? "Erreur");
}

async function readBlobError(err: unknown): Promise<string> {
  if (isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      const parsed = JSON.parse(await err.response.data.text()) as { message?: string };
      return parsed.message ?? "Erreur";
    } catch {
      return "Erreur";
    }
  }
  return errorMessage(err);
}

export default function MvolaExportPage() {
  const can = useCan();
  const queryClient = useQueryClient();
  const [periodIso, setPeriodIso] = useState("");
  const [toExport, setToExport] = useState<ExportQueueRow | null>(null);
  const [toReissue, setToReissue] = useState<ExportQueueRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [group, setGroup] = useState<QueueGroup>("TO_EXPORT");

  const listPeriod = useMemo(() => (periodIso ? periodToExportParam(periodIso) : ""), [periodIso]);
  const referenceYear = periodIso.match(/^(\d{4})-W/)?.[1];

  const queueQuery = useInfiniteQuery({
    queryKey: ["export-queue", listPeriod, referenceYear, group],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<ExportQueuePage>("/bordereaux/export-queue", {
          params: {
            periodIso: listPeriod || undefined,
            referenceYear: listPeriod ? referenceYear : undefined,
            group,
            cursor: pageParam,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    refetchInterval: 15000,
  });
  const { isLoading, isError, refetch } = queueQuery;

  const rows = useMemo(
    () => queueQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [queueQuery.data],
  );
  const counts: Record<QueueGroup, number> = queueQuery.data?.pages[0]?.counts ?? {
    TO_EXPORT: 0,
    EXPORTED: 0,
    ALL: 0,
  };

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["export-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["bordereaux"] });
  }

  const exportMutation = useMutation({
    mutationFn: (row: ExportQueueRow) =>
      api.post<Blob>(`/bordereaux/${row.id}/export`, null, { responseType: "blob" }),
    onSuccess: (response) => {
      downloadBlob(
        response.data,
        filenameFromDisposition(response.headers["content-disposition"], "ALTERRA_MVola.xlsx"),
      );
      const total = response.headers["x-alterra-exported-total"];
      toast({
        title: "Export MVola terminé",
        description: `${response.headers["x-alterra-exported-count"] ?? "?"} ligne(s)${total ? `, total net ${formatAr(total)} Ar` : ""}`,
      });
      setToExport(null);
      refresh();
    },
    onError: async (err) => {
      toast({
        title: "Export impossible",
        description: await readBlobError(err),
        variant: "destructive",
      });
      setToExport(null);
      refresh();
    },
  });

  const reissueMutation = useMutation({
    mutationFn: (row: ExportQueueRow) =>
      api.post<Blob>(`/payments/${row.periodIso}/regenerate-export`, null, {
        responseType: "blob",
        params: { referenceYear: row.referenceYear, siteId: row.siteId },
      }),
    onSuccess: (response) => {
      downloadBlob(
        response.data,
        filenameFromDisposition(response.headers["content-disposition"], "ALTERRA_MVola.xlsx"),
      );
      toast({ title: "Fichier réémis" });
      setToReissue(null);
      refresh();
    },
    onError: async (err) => {
      toast({
        title: "Réémission impossible",
        description: await readBlobError(err),
        variant: "destructive",
      });
      setToReissue(null);
    },
  });

  async function downloadBatch(batch: ExportQueueRow["batches"][number]) {
    try {
      const response = await api.get<Blob>(`/payments/exports/${batch.id}/download`, {
        responseType: "blob",
      });
      downloadBlob(response.data, batch.filename);
    } catch (err) {
      toast({
        title: "Téléchargement échoué",
        description: await readBlobError(err),
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Export MVola"
        description="Seuls les bordereaux validés par la finance puis par le DG sont exportables. Chaque export produit le fichier à envoyer à MVola pour un bordereau."
        action={
          can("paiement:import_statut") ? (
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              Import retour MVola
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="export-period">Filtrer par période (semaine)</Label>
          <Input
            id="export-period"
            type="week"
            value={periodIso}
            onChange={(event) => setPeriodIso(event.target.value)}
            className="w-40"
          />
        </div>
        {periodIso && (
          <Button type="button" variant="outline" onClick={() => setPeriodIso("")}>
            Effacer le filtre
          </Button>
        )}
      </div>

      <FilterChips
        label="Statut des bordereaux"
        value={group}
        onChange={setGroup}
        options={[
          { value: "TO_EXPORT", label: `À exporter (${counts.TO_EXPORT})` },
          { value: "EXPORTED", label: `Exportés (${counts.EXPORTED})` },
          { value: "ALL", label: `Tous (${counts.ALL})` },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Période</TableHead>
              <TableHead className="text-right">N°</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Paiements</TableHead>
              <TableHead className="text-right">Net à envoyer (Ar)</TableHead>
              <TableHead className="text-right">Facture (Ar)</TableHead>
              <TableHead>Fichiers</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRowsSkeleton rows={4} cols={COLUMN_COUNT} />
            ) : isError ? (
              <TableQueryError
                colSpan={COLUMN_COUNT}
                what="les bordereaux à exporter"
                onRetry={() => void refetch()}
              />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="p-0">
                  <EmptyState
                    icon={FileSpreadsheet}
                    title={
                      counts.ALL === 0
                        ? "Aucun bordereau à exporter"
                        : "Aucun bordereau ne correspond à ce statut"
                    }
                    hint={
                      counts.ALL === 0
                        ? "Un bordereau apparaît ici dès que la finance et le DG l'ont validé."
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
                  <TableCell>
                    {row.status === "EXPORTED" ? (
                      <Badge variant="success">Exporté</Badge>
                    ) : (
                      <Badge variant="info">Validé — à exporter</Badge>
                    )}
                    {row.blockedLines.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-danger">
                        {row.blockedLines.map((line) => (
                          <li key={`${line.matricule}-${line.reason}`}>
                            {line.matricule} : {line.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{row.paymentCount}</TableCell>
                  <TableCell className="text-right font-medium">{formatAr(row.totalNet)}</TableCell>
                  <TableCell className="text-right">
                    {row.invoiceNet === null ? "—" : formatAr(row.invoiceNet)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.batches.map((batch) => (
                        <Button
                          key={batch.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void downloadBatch(batch)}
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden />v{batch.version}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {row.status === "DG_VALIDATED" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={row.blockedLines.length > 0 || exportMutation.isPending}
                        onClick={() => setToExport(row)}
                      >
                        Exporter
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={reissueMutation.isPending}
                        onClick={() => setToReissue(row)}
                      >
                        Réémettre
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMoreButton
        hasMore={!!queueQuery.hasNextPage}
        loading={queueQuery.isFetchingNextPage}
        onClick={() => void queueQuery.fetchNextPage()}
      />

      <ConfirmDialog
        open={toExport !== null}
        title="Exporter ce bordereau vers MVola ?"
        description={
          toExport
            ? `Bordereau n° ${toExport.number} — ${toExport.siteName}, ${toExport.periodIso} ${toExport.referenceYear} : ${toExport.paymentCount} paiement(s), ${formatAr(toExport.totalNet)} Ar net. Le fichier sera téléchargé et le bordereau passera à « Exporté ».`
            : ""
        }
        confirmLabel="Exporter"
        busy={exportMutation.isPending}
        onConfirm={() => toExport && exportMutation.mutate(toExport)}
        onOpenChange={(open) => !open && setToExport(null)}
      />

      <ConfirmDialog
        open={toReissue !== null}
        title="Réémettre le fichier MVola ?"
        description="Un nouveau fichier est produit avec les paiements de ce bordereau qui ne sont pas encore confirmés par MVola (paiements envoyés ou en échec). L'ancien fichier reste téléchargeable."
        confirmLabel="Réémettre"
        busy={reissueMutation.isPending}
        onConfirm={() => toReissue && reissueMutation.mutate(toReissue)}
        onOpenChange={(open) => !open && setToReissue(null)}
      />

      <MvolaImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} />
    </div>
  );
}
