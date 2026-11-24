import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Download, History } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";
import { downloadBlob, filenameFromDisposition } from "../../lib/download";
import { formatAr } from "../../lib/money";
import { toast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface InvoiceRevision {
  id: string;
  revision: number;
  current: boolean;
  reason: string;
  createdAt: string;
  createdBy: string | null;
  workerCount: number;
  gross: string;
  isi: string;
  net: string;
}

/** Historique des PDF de la facture d'un bordereau : chaque version reste téléchargeable. */
export default function InvoiceHistory({ bordereauId }: { bordereauId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["bordereau-invoice-revisions", bordereauId],
    enabled: open,
    queryFn: () =>
      api
        .get<{ data: InvoiceRevision[] }>(`/bordereaux/${bordereauId}/invoice/revisions`)
        .then((r) => r.data.data),
  });

  async function download(revision: InvoiceRevision) {
    try {
      const response = await api.get<Blob>(
        `/bordereaux/${bordereauId}/invoice/revisions/${revision.id}`,
        { responseType: "blob" },
      );
      downloadBlob(
        response.data,
        filenameFromDisposition(
          response.headers["content-disposition"],
          `facture_v${revision.revision}.pdf`,
        ),
      );
    } catch (err) {
      toast({
        title: "Téléchargement impossible",
        description: isAxiosError(err) ? String(err.response?.data?.message ?? "Erreur") : "Erreur",
        variant: "destructive",
      });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <History className="h-4 w-4" aria-hidden />
          Historique
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-96 w-96 overflow-y-auto">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          Versions de la facture
        </p>
        {isLoading && <p className="text-sm text-muted">Chargement…</p>}
        {isError && <p className="text-sm text-danger">Historique indisponible.</p>}
        {data && data.length === 0 && (
          <p className="text-sm text-muted">
            Aucune version : la facture n&apos;a pas encore été générée.
          </p>
        )}
        {data && data.length > 0 && (
          <ul className="space-y-2">
            {data.map((revision) => (
              <li
                key={revision.id}
                className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 p-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-zinc-900">
                    Version {revision.revision}
                    {revision.current && <Badge variant="brand">Actuelle</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(revision.createdAt).toLocaleString("fr-FR")}
                    {revision.createdBy ? ` · ${revision.createdBy}` : ""}
                  </p>
                  <p className="text-xs text-muted">{revision.reason}</p>
                  <p className="text-xs text-zinc-700">Net à payer : {formatAr(revision.net)}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Télécharger la version ${revision.revision} de la facture`}
                  onClick={() => void download(revision)}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
