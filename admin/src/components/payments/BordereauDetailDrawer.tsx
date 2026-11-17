import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { Download, FileText } from "lucide-react";
import { api } from "../../lib/api";
import { useCan } from "../../hooks/useCan";
import { toast } from "../../hooks/use-toast";
import { downloadBlob, filenameFromDisposition } from "../../lib/download";
import {
  BORDEREAU_STATUS_LABELS,
  bordereauStatusVariant,
  type BordereauDetail,
} from "../../lib/payments";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { TableQueryError } from "../ui/QueryError";
import { TableRowsSkeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

interface BordereauDetailDrawerProps {
  bordereauId: string | null;
  onClose: () => void;
}

function formatAr(value: string | number): string {
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("fr-FR") : "—";
}

type PendingAction = "finance" | "dg" | null;

export default function BordereauDetailDrawer({
  bordereauId,
  onClose,
}: BordereauDetailDrawerProps) {
  const can = useCan();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingAction>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bordereau", bordereauId],
    enabled: bordereauId !== null,
    queryFn: () => api.get<BordereauDetail>(`/bordereaux/${bordereauId}`).then((r) => r.data),
  });

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ["bordereau"] });
    void queryClient.invalidateQueries({ queryKey: ["bordereaux"] });
  }

  function onError(err: unknown) {
    toast({
      title: "Action impossible",
      description: isAxiosError(err) ? String(err.response?.data?.message ?? "Erreur") : "Erreur",
      variant: "destructive",
    });
    setPending(null);
    setReturnOpen(false);
  }

  const validateMutation = useMutation({
    mutationFn: (step: "finance" | "dg") =>
      api.post(`/bordereaux/${bordereauId}/validate-${step}`).then((r) => r.data),
    onSuccess: (_, step) => {
      toast({
        title: step === "finance" ? "Validation finance enregistrée" : "Validation DG enregistrée",
      });
      setPending(null);
      refreshAll();
    },
    onError,
  });

  const returnMutation = useMutation({
    mutationFn: () => api.post(`/bordereaux/${bordereauId}/return`, { reason }).then((r) => r.data),
    onSuccess: () => {
      toast({ title: "Bordereau renvoyé" });
      setReturnOpen(false);
      setReason("");
      refreshAll();
    },
    onError,
  });

  async function openInvoice(id: string) {
    try {
      const response = await api.get<Blob>(`/bordereaux/${id}/invoice`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      onError(err);
    }
  }

  async function downloadVersion(id: string) {
    try {
      const response = await api.get<Blob>(`/bordereaux/${id}/download`, { responseType: "blob" });
      downloadBlob(
        response.data,
        filenameFromDisposition(response.headers["content-disposition"], "bordereau.xlsx"),
      );
    } catch (err) {
      onError(err);
    }
  }

  const status = data?.status;
  const canFinance = can("bordereau:valider_finance") && status === "GENERATED";
  const canDg = can("bordereau:valider_dg") && status === "FINANCE_VALIDATED";
  const canReturn =
    (can("bordereau:valider_finance") && status === "GENERATED") ||
    (can("bordereau:valider_dg") && status === "FINANCE_VALIDATED");
  const current = data?.versions.find((version) => version.id === data.id);

  return (
    <Sheet open={bordereauId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {data
              ? `Bordereau n° ${data.number} — ${data.siteName} (${data.siteCode})`
              : "Bordereau"}
          </SheetTitle>
          <SheetDescription>
            {data ? `${data.periodIso} ${data.referenceYear} · version ${data.version}` : ""}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {isError && (
            <TableQueryError colSpan={1} what="le bordereau" onRetry={() => void refetch()} />
          )}
          {data && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={bordereauStatusVariant(data.status)}>
                  {BORDEREAU_STATUS_LABELS[data.status]}
                </Badge>
                {current?.financeValidatedAt && (
                  <span className="text-xs text-muted">
                    Finance : {current.financeValidatedBy ?? "—"} ·{" "}
                    {formatDateTime(current.financeValidatedAt)}
                  </span>
                )}
                {current?.dgValidatedAt && (
                  <span className="text-xs text-muted">
                    DG : {current.dgValidatedBy ?? "—"} · {formatDateTime(current.dgValidatedAt)}
                  </span>
                )}
              </div>

              {current?.returnReason && (
                <div
                  role="status"
                  className="rounded-md border border-amber-200 bg-warning-bg p-3 text-sm"
                >
                  <p className="font-medium text-zinc-900">
                    Renvoyé par {current.returnedBy ?? "—"} le {formatDateTime(current.returnedAt)}
                  </p>
                  <p className="text-zinc-700">{current.returnReason}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border border-zinc-200 p-3">
                  <p className="text-xs text-muted">Montant brut</p>
                  <p className="text-base font-semibold">{formatAr(data.totals.gross)} Ar</p>
                </div>
                <div className="rounded-md border border-zinc-200 p-3">
                  <p className="text-xs text-muted">ISI {data.totals.isiRate} %</p>
                  <p className="text-base font-semibold">{formatAr(data.totals.isi)} Ar</p>
                </div>
                <div className="rounded-md border border-zinc-200 p-3">
                  <p className="text-xs text-muted">Net à payer</p>
                  <p className="text-base font-semibold">{formatAr(data.totals.net)} Ar</p>
                </div>
              </div>
              <p className="text-xs text-muted">
                L'ISI et l'arrondi suivent les réglages de l'application (Paramètres) au moment de
                la génération.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Travailleur</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead className="text-right">Montant (Ar)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRowsSkeleton rows={4} cols={4} />
                  ) : (
                    data.lines.map((line) => (
                      <TableRow key={`${line.matricule}-${line.description}`}>
                        <TableCell className="whitespace-nowrap">{line.matricule}</TableCell>
                        <TableCell>{line.workerName}</TableCell>
                        <TableCell className="whitespace-nowrap">{line.mvolaNumber}</TableCell>
                        <TableCell className="text-right">{formatAr(line.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-900">Versions</h3>
                {data.versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        Version {version.version}{" "}
                        <Badge variant={bordereauStatusVariant(version.status)}>
                          {BORDEREAU_STATUS_LABELS[version.status]}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted">
                        Générée le {formatDateTime(version.createdAt)}
                        {version.createdBy ? ` par ${version.createdBy}` : ""}
                      </p>
                      {version.financeValidatedAt && (
                        <p className="text-xs text-muted">
                          Finance : {version.financeValidatedBy ?? "—"}
                          {version.dgValidatedAt ? ` · DG : ${version.dgValidatedBy ?? "—"}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {can("facture:lecture") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void openInvoice(version.id)}
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          Facture
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void downloadVersion(version.id)}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        Bordereau (Excel)
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {canReturn && (
            <Button type="button" variant="outline" onClick={() => setReturnOpen(true)}>
              Renvoyer
            </Button>
          )}
          {canFinance && (
            <Button type="button" onClick={() => setPending("finance")}>
              Valider (finance)
            </Button>
          )}
          {canDg && (
            <Button type="button" onClick={() => setPending("dg")}>
              Valider (DG)
            </Button>
          )}
        </SheetFooter>
      </SheetContent>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending === "dg" ? "Valider ce bordereau (DG) ?" : "Valider ce bordereau (finance) ?"
        }
        description={
          pending === "dg"
            ? "Après cette deuxième validation, le bordereau et sa facture ne pourront plus changer."
            : "Le bordereau passera à la validation du DG. Vous ne pourrez plus modifier ses paiements."
        }
        confirmLabel="Valider"
        busy={validateMutation.isPending}
        onConfirm={() => pending && validateMutation.mutate(pending)}
        onOpenChange={(open) => !open && setPending(null)}
      />

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renvoyer ce bordereau</DialogTitle>
            <DialogDescription>
              Il repasse en « À valider (finance) » et son auteur pourra le corriger ou le
              régénérer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-reason">Motif (10 caractères minimum)</Label>
            <textarea
              id="return-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm hover:border-zinc-400 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReturnOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={reason.trim().length < 10 || returnMutation.isPending}
              onClick={() => returnMutation.mutate()}
            >
              Renvoyer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
