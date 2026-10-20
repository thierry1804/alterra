import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { Download, FileText, Receipt, RefreshCw } from "lucide-react";
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
  const queryClient = useQueryClient();
  const [periodIso, setPeriodIso] = useState(currentIsoWeekInput());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
    // Pas de websocket/push : on repolle pour voir vite les factures générées par un export MVola
    // fait depuis un autre onglet/poste (page Paiements).
    refetchInterval: 15000,
  });

  const rows = data ?? [];

  // Permet le rattrapage : un export MVola existe pour cette période mais aucune facture n'a
  // été générée (échec de la génération auto à l'export, ou export fait avant cette fonctionnalité).
  const { data: exportedCount } = useQuery({
    queryKey: ["invoices-exported-check", periodIso],
    queryFn: () =>
      api
        .get<{ data: unknown[] }>("/payments", {
          params: { periodIso, referenceYear, status: "EXPORTED" },
        })
        .then((r) => r.data.data.length),
    enabled: !!periodIso,
  });

  const canGenerateManually = !!periodIso && !isLoading && rows.length === 0 && !!exportedCount;

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post("/invoices/generate", { periodIso, referenceYear: Number(referenceYear) }),
    onSuccess: (res) => {
      toast({
        title: "Facture(s) générée(s)",
        description: `${res.data.created.length} facture(s) créée(s)`,
      });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Génération échouée", description: String(message), variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (invoiceId: string) => api.post(`/invoices/${invoiceId}/regenerate`),
    onSuccess: () => {
      toast({ title: "Facture régénérée" });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({
        title: "Régénération échouée",
        description: String(message),
        variant: "destructive",
      });
    },
  });

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Factures"
        description="Une facture PDF par activité et par période, générée automatiquement à chaque export MVola."
        help={
          <ContextHelp id="invoices-admin" title="Factures par activité">
            <p>
              Chaque export MVola (page Paiements) génère une facture par activité regroupant les
              travailleurs validés de cette activité pour la période exportée.
            </p>
            <GlossaryTerm term="Semaine ISO">
              Format AAAA-Wnn (ex. 2026-W29) — période de paie hebdomadaire.
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
        {canGenerateManually && (
          <Button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            <Receipt className="h-4 w-4" />
            {generateMutation.isPending ? "Génération…" : "Générer facture(s) pour cette période"}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-subtle">
            <tr>
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
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  Aucune facture — générée automatiquement au prochain export MVola.
                </td>
              </tr>
            )}
            {rows.map((invoice) => (
              <tr key={invoice.id}>
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
                      icon={RefreshCw}
                      label="Régénérer cette facture"
                      loading={
                        regenerateMutation.isPending && regenerateMutation.variables === invoice.id
                      }
                      onClick={() => regenerateMutation.mutate(invoice.id)}
                    />
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
