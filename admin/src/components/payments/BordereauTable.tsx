import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import type { PaymentRow } from "../../lib/payments";
import {
  PAYMENT_STATUS_LABELS,
  RECONCILIATION_LABELS,
  formatPaymentAmount,
  paymentStatusVariant,
} from "../../lib/payments";
import { Ban, Pencil, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { IconButton, RowActions } from "../ui/IconButton";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { toast } from "../../hooks/use-toast";
import { useCan } from "../../hooks/useCan";
import { api } from "../../lib/api";
import PaymentAdjustDialog, { type AdjustablePayment } from "./PaymentAdjustDialog";

interface BordereauTableProps {
  rows: PaymentRow[];
  loading: boolean;
  onCorrected: () => void;
}

export default function BordereauTable({ rows, loading, onCorrected }: BordereauTableProps) {
  const can = useCan();
  const canFail = can("paiement:correction");
  const queryClient = useQueryClient();
  const [adjusting, setAdjusting] = useState<AdjustablePayment | null>(null);
  const [failingId, setFailingId] = useState<string | null>(null);
  const [failReason, setFailReason] = useState("");

  const failMutation = useMutation({
    mutationFn: ({ id, failureReason }: { id: string; failureReason: string }) =>
      api.patch(`/payments/${id}/fail`, { failureReason }),
    onSuccess: () => {
      toast({ title: "Paiement marqué en échec" });
      setFailingId(null);
      setFailReason("");
      onCorrected();
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Action impossible", description: String(message), variant: "destructive" });
    },
  });

  return (
    <div className="rounded-lg border border-zinc-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>MOC</TableHead>
            <TableHead>MVola</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Brut</TableHead>
            <TableHead className="text-right">ISI</TableHead>
            <TableHead className="text-right">Net à payer</TableHead>
            <TableHead>Bio</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Rapprochement MVola</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={10} className="text-zinc-500">
                Chargement…
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.worker.firstName} {row.worker.lastName}
                </TableCell>
                <TableCell>{row.worker.mvolaNumber}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={row.description}>
                  {row.description}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {formatPaymentAmount(row.amount)}
                  {row.adjustments.length > 0 && (
                    <p className="text-xs text-muted">
                      dont {row.adjustments.length} ajustement(s)
                    </p>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {formatPaymentAmount(row.isiAmount)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium">
                  {formatPaymentAmount(row.netAmount)}
                </TableCell>
                <TableCell>
                  <Badge variant={row.bioValid ? "success" : "danger"}>
                    {row.bioValid ? "OUI" : "NON"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={paymentStatusVariant(row.status)}>
                    {PAYMENT_STATUS_LABELS[row.status]}
                  </Badge>
                  {row.failureReason && (
                    <p className="mt-1 text-xs text-red-600">{row.failureReason}</p>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {row.reconciliationStatus ? (
                    <>
                      <Badge
                        variant={row.reconciliationStatus === "CONFIRME" ? "success" : "warning"}
                      >
                        {RECONCILIATION_LABELS[row.reconciliationStatus]}
                      </Badge>
                      {row.mvolaReference && (
                        <p className="mt-1 font-mono text-zinc-500">Réf. {row.mvolaReference}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {canFail && row.status === "EXPORTED" && failingId !== row.id && (
                    <RowActions>
                      <IconButton
                        icon={Ban}
                        label="Marquer en échec"
                        variant="destructive"
                        onClick={() => {
                          setFailingId(row.id);
                          setFailReason("");
                        }}
                      />
                    </RowActions>
                  )}
                  {failingId === row.id && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Motif de l'échec (min. 10 car.)"
                        value={failReason}
                        onChange={(e) => setFailReason(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          disabled={failReason.trim().length < 10 || failMutation.isPending}
                          onClick={() =>
                            failMutation.mutate({ id: row.id, failureReason: failReason.trim() })
                          }
                        >
                          Confirmer
                        </Button>
                        <IconButton icon={X} label="Annuler" onClick={() => setFailingId(null)} />
                      </div>
                    </div>
                  )}
                  {canFail &&
                    row.status === "PENDING" &&
                    row.bordereauStatus === "GENERATED" &&
                    failingId !== row.id && (
                      <RowActions>
                        <IconButton
                          icon={Pencil}
                          label="Ajuster le montant"
                          variant="brand"
                          onClick={() =>
                            setAdjusting({
                              paymentId: row.id,
                              title: `${row.worker.firstName} ${row.worker.lastName}`,
                              amount: row.amount,
                              isiAmount: row.isiAmount,
                              netAmount: row.netAmount,
                              adjustments: row.adjustments,
                            })
                          }
                        />
                      </RowActions>
                    )}
                </TableCell>
              </TableRow>
            ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-zinc-500">
                Aucune ligne pour cette période.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PaymentAdjustDialog
        payment={adjusting}
        onClose={() => setAdjusting(null)}
        onChanged={() => {
          onCorrected();
          void queryClient.invalidateQueries({ queryKey: ["bordereaux"] });
          void queryClient.invalidateQueries({ queryKey: ["bordereau"] });
        }}
      />
    </div>
  );
}
