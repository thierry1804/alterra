import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { MvolaExportEntry } from "../../lib/payments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { TableQueryError } from "../ui/QueryError";

/** Derniers exports MVola : qui a exporté quelle période, quand, combien de lignes. */
export default function MvolaExportHistory({ refreshKey }: { refreshKey?: number }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payments-exports", refreshKey],
    queryFn: () => api.get<{ data: MvolaExportEntry[] }>("/payments/exports").then((r) => r.data.data),
  });

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-900">Historique des exports MVola</h2>
      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Lignes</TableHead>
              <TableHead>Fichier</TableHead>
              <TableHead>Exporté par</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableQueryError colSpan={5} what="l'historique des exports" onRetry={() => void refetch()} />
            )}
            {!isLoading && !isError && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-zinc-500">
                  Aucun export pour le moment.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString("fr-FR")}
                </TableCell>
                <TableCell>{entry.periodIso ?? "—"}</TableCell>
                <TableCell>{entry.exportedCount ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{entry.filename ?? "—"}</TableCell>
                <TableCell>{entry.userEmail ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
