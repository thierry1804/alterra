import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, Download, FileText } from "lucide-react";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { api } from "../lib/api";
import { currentIsoWeekInput, periodToExportParam } from "../lib/payments";
import { formatInvoiceAmount, type InvoiceRow } from "../lib/invoices";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "../hooks/use-toast";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

export default function InvoicesPage() {
  const [periodIso, setPeriodIso] = useState(currentIsoWeekInput());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const referenceYear = periodIso.match(/^(\d{4})-W/)?.[1];
  const listPeriod = periodIso ? periodToExportParam(periodIso) : "";

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", listPeriod],
    queryFn: () =>
      api
        .get<{ data: InvoiceRow[] }>("/invoices", {
          params: listPeriod ? { periodIso: listPeriod, referenceYear } : undefined,
        })
        .then((r) => r.data.data),
  });

  const rows = data ?? [];

  async function handleDownload(invoice: InvoiceRow) {
    setDownloadingId(invoice.id);
    try {
      const response = await api.get(`/invoices/${invoice.id}/download`, {
        responseType: "blob",
      });
      const disposition = response.headers["content-disposition"] as string | undefined;
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `facture_${invoice.periodIso}.pdf`;

      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Téléchargement échoué",
        description: "Impossible de récupérer la facture.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);
    try {
      const response = await api.get("/invoices/download-all", {
        responseType: "blob",
        params: { periodIso: listPeriod, referenceYear },
      });
      const disposition = response.headers["content-disposition"] as string | undefined;
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `factures_${listPeriod}.zip`;

      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Téléchargement échoué",
        description: "Impossible de récupérer les factures de cette période.",
        variant: "destructive",
      });
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Factures — archives"
        description="Anciennes factures (une par activité et par période), en lecture seule. Les nouvelles factures se consultent depuis chaque bordereau."
        help={
          <ContextHelp id="invoices-admin" title="Factures — archives">
            <p>
              Ces factures ont été créées avant la facture par bordereau. Elles restent consultables
              mais ne sont plus modifiables ni régénérées.
            </p>
            <GlossaryTerm term="Semaine ISO">
              Format AAAA-Wnn (ex. 2026-W29) - période de paie hebdomadaire.
            </GlossaryTerm>
          </ContextHelp>
        }
      />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 p-4">
        <div className="space-y-2">
          <Label htmlFor="invoice-period">Filtrer par période (ISO semaine)</Label>
          <Input
            id="invoice-period"
            type="week"
            value={periodIso}
            onChange={(e) => setPeriodIso(e.target.value)}
            className="w-40"
          />
        </div>
        {periodIso && (
          <Button type="button" variant="outline" onClick={() => setPeriodIso("")}>
            Effacer le filtre
          </Button>
        )}
        {!isLoading && rows.length > 0 && (
          <IconButton
            icon={Archive}
            label="Télécharger toutes les factures de cette période (ZIP)"
            loading={downloadingAll}
            onClick={() => void handleDownloadAll()}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-2">N°</th>
              <th className="px-4 py-2">Activité</th>
              <th className="px-4 py-2">Site</th>
              <th className="px-4 py-2">Période</th>
              <th className="px-4 py-2">Travailleurs</th>
              <th className="px-4 py-2">PU</th>
              <th className="px-4 py-2">Montant</th>
              <th className="px-4 py-2">Générée le</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                  Aucune facture archivée pour cette période.
                </td>
              </tr>
            )}
            {rows.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-2 text-zinc-500">{invoice.number ?? "-"}</td>
                <td className="flex items-center gap-2 px-4 py-2 font-medium text-zinc-900">
                  <FileText className="h-4 w-4 shrink-0 text-subtle" />
                  {invoice.activityLabel}
                </td>
                <td className="px-4 py-2">{invoice.siteLabel}</td>
                <td className="px-4 py-2">
                  {invoice.periodIso}
                  {invoice.referenceYear ? ` / ${invoice.referenceYear}` : ""}
                </td>
                <td className="px-4 py-2">{invoice.workerCount}</td>
                <td className="px-4 py-2">{formatInvoiceAmount(invoice.unitRate)}</td>
                <td className="px-4 py-2">{formatInvoiceAmount(invoice.totalAmount)}</td>
                <td className="px-4 py-2 text-zinc-500">{formatDateTime(invoice.createdAt)}</td>
                <td className="px-4 py-2 text-right">
                  <RowActions>
                    <IconButton
                      icon={Download}
                      label="Télécharger le PDF"
                      loading={downloadingId === invoice.id}
                      onClick={() => void handleDownload(invoice)}
                    />
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
