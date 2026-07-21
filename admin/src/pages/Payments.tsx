import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import {
  currentIsoWeekInput,
  periodToExportParam,
  type PaymentRow,
} from "../lib/payments";
import PageHeader from "../components/shared/PageHeader";
import BordereauTable from "../components/payments/BordereauTable";
import MvolaExportButton from "../components/payments/MvolaExportButton";
import MvolaImportDialog from "../components/payments/MvolaImportDialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "../hooks/use-toast";

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [periodIso, setPeriodIso] = useState(currentIsoWeekInput());
  const [importOpen, setImportOpen] = useState(false);

  const listPeriod = useMemo(() => periodToExportParam(periodIso), [periodIso]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["payments", listPeriod],
    queryFn: () =>
      api
        .get<{ periodIso: string; data: PaymentRow[] }>("/payments", {
          params: { periodIso: listPeriod, referenceYear: periodIso.match(/^(\d{4})-W/)?.[1] },
        })
        .then((r) => r.data),
    enabled: !!listPeriod,
  });

  const rows = useMemo(() => data?.data ?? [], [data?.data]);

  const stats = useMemo(() => {
    const exportable = rows.filter((r) => r.status === "PENDING" && r.bioValid && Number(r.amount) > 0);
    const blocked = rows.filter((r) => r.status === "PENDING" && !r.bioValid);
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    return { exportable: exportable.length, blocked: blocked.length, totalAmount, total: rows.length };
  }, [rows]);

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post("/payments/generate", {
        periodIso,
        referenceYear: Number(periodIso.match(/^(\d{4})-W/)?.[1]),
      }),
    onSuccess: (res) => {
      toast({
        title: "Bordereau généré",
        description: `${res.data.created} ligne(s) créée(s)`,
      });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (err) => {
      const code = isAxiosError(err) ? err.response?.data?.code : null;
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      if (code === "PAY_CONFLICT") {
        toast({
          title: "Conflit période",
          description: String(message),
          variant: "destructive",
        });
      } else {
        toast({ title: "Génération échouée", description: String(message), variant: "destructive" });
      }
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements"
        description="Bordereau MVola — génération, export et import retour."
      />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 p-4">
        <div className="space-y-2">
          <Label htmlFor="pay-period">Période (ISO semaine)</Label>
          <Input
            id="pay-period"
            value={periodIso}
            onChange={(e) => setPeriodIso(e.target.value)}
            placeholder="2026-W29"
            className="w-40"
          />
        </div>
        <Button
          type="button"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? "Génération…" : "Générer bordereau"}
        </Button>
        <MvolaExportButton
          periodIso={periodIso}
          disabled={stats.exportable === 0}
          onExported={() => void refetch()}
        />
        <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
          Import retour MVola
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">Lignes</p>
          <p className="text-xl font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">Exportables (bio OK)</p>
          <p className="text-xl font-semibold">{stats.exportable}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">Bloquées bio</p>
          <p className="text-xl font-semibold text-amber-700">{stats.blocked}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">Masse totale</p>
          <p className="text-xl font-semibold">{stats.totalAmount.toLocaleString("fr-MG")} Ar</p>
        </div>
      </div>

      <BordereauTable rows={rows} loading={isLoading} onCorrected={() => void refetch()} />

      <MvolaImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        periodIso={listPeriod}
        onImported={() => void refetch()}
      />
    </div>
  );
}
