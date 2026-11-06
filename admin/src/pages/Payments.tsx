import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { ClipboardList, CreditCard, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { useSiteScope } from "../lib/site-scope";
import { currentIsoWeekInput, periodToExportParam, type PaymentRow } from "../lib/payments";
import PageHeader from "../components/shared/PageHeader";
import KpiCards, { type StatCardItem } from "../components/dashboard/KpiCards";
import PaymentFlow from "../components/payments/PaymentFlow";
import BordereauTable from "../components/payments/BordereauTable";
import MvolaExportHistory from "../components/payments/MvolaExportHistory";
import MvolaExportButton from "../components/payments/MvolaExportButton";
import MvolaImportDialog from "../components/payments/MvolaImportDialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "../hooks/use-toast";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import ConfirmDialog from "../components/ui/ConfirmDialog";

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [siteId] = useSiteScope();
  const [periodIso, setPeriodIso] = useState(currentIsoWeekInput());
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generateCorrectionsWarning, setGenerateCorrectionsWarning] = useState<string | null>(
    null,
  );

  const listPeriod = useMemo(() => periodToExportParam(periodIso), [periodIso]);
  const referenceYear = periodIso.match(/^(\d{4})-W/)?.[1];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["payments", listPeriod, siteId],
    queryFn: () =>
      api
        .get<{ periodIso: string; data: PaymentRow[] }>("/payments", {
          params: {
            periodIso: listPeriod,
            referenceYear: periodIso.match(/^(\d{4})-W/)?.[1],
            siteId: siteId || undefined,
          },
        })
        .then((r) => r.data),
    enabled: !!listPeriod,
    // Pas de websocket/push : on repolle pour refléter vite les paiements générés/exportés ailleurs.
    refetchInterval: 15000,
  });

  const rows = useMemo(() => data?.data ?? [], [data?.data]);

  const stats = useMemo(() => {
    const exportable = rows.filter(
      (r) => r.status === "PENDING" && r.bioValid && Number(r.amount) > 0,
    );
    const blocked = rows.filter((r) => r.status === "PENDING" && !r.bioValid);
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    return {
      exported: rows.filter((r) => r.status === "EXPORTED").length,
      exportable: exportable.length,
      blocked: blocked.length,
      totalAmount,
      total: rows.length,
    };
  }, [rows]);

  const generateMutation = useMutation({
    mutationFn: (force?: boolean) =>
      api.post("/payments/generate", {
        periodIso,
        referenceYear: Number(periodIso.match(/^(\d{4})-W/)?.[1]),
        force,
      }),
    onSuccess: (res) => {
      setGenerateCorrectionsWarning(null);
      toast({
        title: "Bordereau généré",
        description: `${res.data.created} ligne(s) créée(s)`,
      });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (err) => {
      const code = isAxiosError(err) ? err.response?.data?.code : null;
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      if (code === "PAY_HAS_CORRECTIONS") {
        setGenerateCorrectionsWarning(String(message));
      } else if (code === "PAY_CONFLICT") {
        toast({
          title: "Conflit période",
          description: String(message),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Génération échouée",
          description: String(message),
          variant: "destructive",
        });
      }
    },
  });

  const deletable = rows.length > 0 && rows.every((r) => r.status === "PENDING");

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(`/payments/${listPeriod}`, {
        params: {
          referenceYear: periodIso.match(/^(\d{4})-W/)?.[1],
          siteId: siteId || undefined,
        },
      }),
    onSuccess: (res) => {
      toast({
        title: "Bordereau supprimé",
        description: `${res.data.deleted} ligne(s) supprimée(s)`,
      });
      setDeleteConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Suppression échouée", description: String(message), variant: "destructive" });
      setDeleteConfirmOpen(false);
    },
  });

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const response = await api.post(`/payments/${listPeriod}/regenerate-export`, null, {
        responseType: "blob",
        params: { referenceYear },
      });
      const disposition = response.headers["content-disposition"] as string | undefined;
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `ALTERRA_MVola_${listPeriod}_regenere.xlsx`;
      const version = response.headers["x-alterra-version"];

      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Bordereau régénéré",
        description: version ? `Nouvelle version v${version}` : undefined,
      });
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ["payments-exports"] });
    } catch (err) {
      const code = isAxiosError(err) ? err.response?.data?.code : null;
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({
        title: code === "NO_PREVIOUS_EXPORT" ? "Aucun bordereau à régénérer" : "Régénération échouée",
        description: String(message),
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  }

  const paymentStats = useMemo((): StatCardItem[] => {
    return [
      {
        key: "total",
        label: "Lignes",
        icon: ClipboardList,
        displayValue: String(stats.total),
      },
      {
        key: "exportable",
        label: "Exportables (bio OK)",
        icon: Wallet,
        displayValue: String(stats.exportable),
      },
      {
        key: "blocked",
        label: "Bloquées bio",
        icon: ShieldAlert,
        displayValue: String(stats.blocked),
        valueClassName: stats.blocked > 0 ? "text-amber-700" : undefined,
        highlight: stats.blocked > 0,
      },
      {
        key: "amount",
        label: "Masse totale",
        icon: CreditCard,
        displayValue: `${stats.totalAmount.toLocaleString("fr-MG")} Ar`,
      },
    ];
  }, [stats]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Paiements"
        description="Bordereau MVola — génération, export et import retour."
        help={
          <ContextHelp id="payments-admin" title="Paiements MVola">
            <GlossaryTerm term="Semaine ISO">
              Format AAAA-Wnn (ex. 2026-W29) — période de paie hebdomadaire.
            </GlossaryTerm>
            <GlossaryTerm term="Bio OK">
              Travailleurs dont le contrôle biométrique autorise l&apos;export MVola.
            </GlossaryTerm>
          </ContextHelp>
        }
      />

      <PaymentFlow
        periodIso={periodIso}
        total={stats.total}
        exportable={stats.exportable}
        exported={stats.exported}
        blocked={stats.blocked}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="space-y-2">
          <Label htmlFor="pay-period">Période (ISO semaine)</Label>
          <Input
            id="pay-period"
            type="week"
            value={periodIso}
            onChange={(e) => e.target.value && setPeriodIso(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          type="button"
          onClick={() => generateMutation.mutate(undefined)}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? "Génération…" : "Générer bordereau"}
        </Button>
        <MvolaExportButton
          periodIso={periodIso}
          siteId={siteId}
          disabled={stats.exportable === 0}
          onExported={() => void refetch()}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleRegenerate()}
          disabled={regenerating}
        >
          <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Régénération…" : "Régénérer le bordereau"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
          Import retour MVola
        </Button>
        {deletable && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleteMutation.isPending}
          >
            Supprimer bordereau
          </Button>
        )}
      </div>

      <KpiCards stats={paymentStats} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer le bordereau ?"
        description={`${rows.length} ligne(s) en attente pour la période ${periodIso} seront définitivement supprimées. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onOpenChange={setDeleteConfirmOpen}
      />

      <ConfirmDialog
        open={generateCorrectionsWarning !== null}
        title="Des paiements ont été corrigés manuellement"
        description={`${generateCorrectionsWarning}. Continuer quand même ?`}
        confirmLabel="Régénérer quand même"
        destructive
        busy={generateMutation.isPending}
        onConfirm={() => generateMutation.mutate(true)}
        onOpenChange={(open) => !open && setGenerateCorrectionsWarning(null)}
      />

      <BordereauTable rows={rows} loading={isLoading} onCorrected={() => void refetch()} />

      <MvolaExportHistory
        refreshKey={data?.data?.filter((r) => r.status === "EXPORTED").length}
        periodIso={listPeriod}
        referenceYear={referenceYear}
      />

      <MvolaImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void refetch()}
      />
    </div>
  );
}
