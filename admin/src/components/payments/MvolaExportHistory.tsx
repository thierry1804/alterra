import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "../../lib/api";
import type { MvolaExportEntry } from "../../lib/payments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { TableQueryError } from "../ui/QueryError";
import { IconButton, RowActions } from "../ui/IconButton";
import { Badge } from "../ui/badge";
import { toast } from "../../hooks/use-toast";

interface MvolaExportHistoryProps {
  refreshKey?: number;
  /** Filtre optionnel sur la période affichée — sans filtre, toutes les périodes sont listées. */
  periodIso?: string;
  referenceYear?: string;
}

/** Bordereaux MVola (export initial + régénérations) : qui, quand, quelle version, combien de lignes. */
export default function MvolaExportHistory({
  refreshKey,
  periodIso,
  referenceYear,
}: MvolaExportHistoryProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payments-exports", refreshKey, periodIso, referenceYear],
    queryFn: () =>
      api
        .get<{ data: MvolaExportEntry[] }>("/payments/exports", {
          params: periodIso ? { periodIso, referenceYear } : undefined,
        })
        .then((r) => r.data.data),
  });

  async function handleDownload(entry: MvolaExportEntry) {
    setDownloadingId(entry.id);
    try {
      const response = await api.get(`/payments/exports/${entry.id}/download`, {
        responseType: "blob",
      });
      const disposition = response.headers["content-disposition"] as string | undefined;
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? entry.filename ?? "export-mvola.xlsx";

      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Téléchargement échoué",
        description: "Impossible de récupérer ce fichier d'export.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-900">Historique des exports MVola</h2>
      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Lignes</TableHead>
              <TableHead>Fichier</TableHead>
              <TableHead>Exporté par</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableQueryError
                colSpan={7}
                what="l'historique des exports"
                onRetry={() => void refetch()}
              />
            )}
            {!isLoading && !isError && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-zinc-500">
                  Aucun export pour le moment.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString("fr-FR")}
                </TableCell>
                <TableCell>{entry.periodIso ?? "-"}</TableCell>
                <TableCell>
                  <span className="alterra-num">v{entry.version}</span>
                  {entry.isCurrent && (
                    <Badge variant="success" className="ml-2">
                      Actuel
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{entry.exportedCount ?? "-"}</TableCell>
                <TableCell className="font-mono text-xs">{entry.filename ?? "-"}</TableCell>
                <TableCell>{entry.userEmail ?? "-"}</TableCell>
                <TableCell>
                  <RowActions>
                    <IconButton
                      icon={Download}
                      label="Télécharger ce fichier d'export"
                      loading={downloadingId === entry.id}
                      onClick={() => void handleDownload(entry)}
                    />
                  </RowActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
