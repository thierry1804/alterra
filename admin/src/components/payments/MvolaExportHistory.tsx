import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "../../lib/api";
import { downloadBlob } from "../../lib/download";
import { useCan } from "../../hooks/useCan";
import { toast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { IconButton } from "../ui/IconButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

interface MvolaExportBatchRow {
  id: string;
  createdAt: string;
  userEmail: string | null;
  periodIso: string;
  referenceYear: number | null;
  version: number;
  isCurrent: boolean;
  exportedCount: number;
  filename: string;
}

interface MvolaExportHistoryProps {
  periodIso: string;
  referenceYear?: string;
  refreshKey?: number;
}

export default function MvolaExportHistory({
  periodIso,
  referenceYear,
  refreshKey,
}: MvolaExportHistoryProps) {
  const can = useCan();

  const { data } = useQuery({
    queryKey: ["payments-exports", periodIso, referenceYear, refreshKey],
    queryFn: () =>
      api
        .get<{ data: MvolaExportBatchRow[] }>("/payments/exports", {
          params: { periodIso, referenceYear },
        })
        .then((r) => r.data.data),
    enabled: can("paiement:lecture") && !!periodIso,
  });

  if (!can("paiement:lecture")) return null;

  const batches = data ?? [];

  async function download(batch: MvolaExportBatchRow) {
    try {
      const response = await api.get<Blob>(`/payments/exports/${batch.id}/download`, {
        responseType: "blob",
      });
      downloadBlob(response.data, batch.filename);
    } catch {
      toast({
        title: "Téléchargement échoué",
        description: "Impossible de récupérer le fichier.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-2">
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
            {batches.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-zinc-500">
                  Aucun export pour le moment.
                </TableCell>
              </TableRow>
            )}
            {batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(batch.createdAt).toLocaleString("fr-FR")}
                </TableCell>
                <TableCell>{batch.periodIso}</TableCell>
                <TableCell>
                  v{batch.version} {batch.isCurrent && <Badge variant="success">Actuelle</Badge>}
                </TableCell>
                <TableCell>{batch.exportedCount}</TableCell>
                <TableCell className="max-w-[260px] truncate" title={batch.filename}>
                  {batch.filename}
                </TableCell>
                <TableCell>{batch.userEmail ?? "-"}</TableCell>
                <TableCell>
                  {can("paiement:export") && (
                    <IconButton
                      icon={Download}
                      label="Télécharger ce fichier"
                      onClick={() => void download(batch)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
