import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "../../hooks/use-toast";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export interface AdjustablePayment {
  paymentId: string;
  title: string;
  amount: string;
  isiAmount: string;
  netAmount: string;
  adjustments: Array<{ id: string; amount: string; reason: string }>;
}

interface PaymentAdjustDialogProps {
  payment: AdjustablePayment | null;
  onClose: () => void;
  onChanged: () => void;
}

function formatAr(value: string | number): string {
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Ar`;
}

function signed(value: string | number): string {
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Ar`;
}

function messageOf(err: unknown): string {
  return isAxiosError(err) ? String(err.response?.data?.message ?? "Erreur") : "Erreur";
}

export default function PaymentAdjustDialog({
  payment,
  onClose,
  onChanged,
}: PaymentAdjustDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const parsed = Number(amount.replace(",", "."));
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed !== 0;
  const canSubmit = valid && reason.trim().length >= 10;

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/payments/${payment!.paymentId}/adjustments`, {
        amount: parsed,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast({ title: "Ajustement enregistré", description: "La facture est mise à jour." });
      setAmount("");
      setReason("");
      onChanged();
      onClose();
    },
    onError: (err) =>
      toast({
        title: "Ajustement impossible",
        description: messageOf(err),
        variant: "destructive",
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (adjustmentId: string) => api.delete(`/payments/adjustments/${adjustmentId}`),
    onSuccess: () => {
      toast({ title: "Ajustement retiré", description: "La facture est mise à jour." });
      onChanged();
      onClose();
    },
    onError: (err) =>
      toast({ title: "Retrait impossible", description: messageOf(err), variant: "destructive" }),
  });

  return (
    <Dialog open={payment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajuster le paiement</DialogTitle>
          <DialogDescription>{payment?.title}</DialogDescription>
        </DialogHeader>

        {payment && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-xs text-muted">Brut</p>
                <p className="font-semibold">{formatAr(payment.amount)}</p>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-xs text-muted">ISI</p>
                <p className="font-semibold">{formatAr(payment.isiAmount)}</p>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-xs text-muted">Net à payer</p>
                <p className="font-semibold">{formatAr(payment.netAmount)}</p>
              </div>
            </div>

            {payment.adjustments.length > 0 && (
              <ul className="space-y-2">
                {payment.adjustments.map((adjustment) => (
                  <li
                    key={adjustment.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{signed(adjustment.amount)}</p>
                      <p className="text-xs text-muted">{adjustment.reason}</p>
                    </div>
                    <IconButton
                      icon={Trash2}
                      label="Retirer cet ajustement"
                      variant="destructive"
                      loading={
                        removeMutation.isPending && removeMutation.variables === adjustment.id
                      }
                      onClick={() => removeMutation.mutate(adjustment.id)}
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="adjust-amount">
                  Montant de l'ajustement (Ar, négatif pour une retenue)
                </Label>
                <Input
                  id="adjust-amount"
                  type="number"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-48"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="adjust-reason">Motif (10 caractères minimum)</Label>
                <textarea
                  id="adjust-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm hover:border-zinc-400 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                />
              </div>
              <p className="text-xs text-muted">
                L'ajustement entre dans l'ISI, le net, la facture et le fichier MVola. Il n'est
                possible que tant que le bordereau n'est pas validé par la finance.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
              <Button
                type="button"
                disabled={!canSubmit || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? "Enregistrement…" : "Ajuster"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
