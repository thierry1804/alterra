import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import type { PaymentRow } from "../../lib/payments";
import {
  PAYMENT_STATUS_LABELS,
  formatPaymentAmount,
  paymentStatusVariant,
} from "../../lib/payments";
import { Pencil, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { IconButton, RowActions } from "../ui/IconButton";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "../../hooks/use-toast";
import { api } from "../../lib/api";

interface BordereauTableProps {
  rows: PaymentRow[];
  loading: boolean;
  onCorrected: () => void;
}

export default function BordereauTable({ rows, loading, onCorrected }: BordereauTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const correctMutation = useMutation({
    mutationFn: ({ id, amount, correctionReason }: { id: string; amount: number; correctionReason: string }) =>
      api.patch(`/payments/${id}`, { amount, correctionReason }),
    onSuccess: () => {
      toast({ title: "Montant corrigé" });
      setEditingId(null);
      setReason("");
      onCorrected();
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Correction échouée", description: String(message), variant: "destructive" });
    },
  });

  function startEdit(row: PaymentRow) {
    setEditingId(row.id);
    setAmount(row.amount);
    setReason("");
  }

  return (
    <div className="rounded-lg border border-zinc-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>MOC</TableHead>
            <TableHead>MVola</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Bio</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7} className="text-zinc-500">
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
                <TableCell>
                  {editingId === row.id ? (
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-8 w-28"
                    />
                  ) : (
                    formatPaymentAmount(row.amount)
                  )}
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
                <TableCell>
                  {row.status === "PENDING" && editingId !== row.id && (
                    <RowActions>
                      <IconButton
                        icon={Pencil}
                        label="Corriger le montant"
                        variant="brand"
                        onClick={() => startEdit(row)}
                      />
                    </RowActions>
                  )}
                  {editingId === row.id && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Motif (min. 10 car.)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          disabled={reason.trim().length < 10 || correctMutation.isPending}
                          onClick={() =>
                            correctMutation.mutate({
                              id: row.id,
                              amount: Number(amount),
                              correctionReason: reason.trim(),
                            })
                          }
                        >
                          OK
                        </Button>
                        <IconButton icon={X} label="Annuler" onClick={() => setEditingId(null)} />
                      </div>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-zinc-500">
                Aucune ligne pour cette période.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
