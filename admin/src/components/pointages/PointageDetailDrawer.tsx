import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { Camera, MapPin } from "lucide-react";
import { api } from "../../lib/api";
import type { Pointage } from "../../lib/pointages";
import {
  POINTAGE_STATUS_LABELS,
  formatPointageAmount,
  pointageStatusVariant,
} from "../../lib/pointages";
import type { Activity, Worker } from "../../lib/referentials";
import { formatDate } from "../../lib/referentials";
import { useAuth } from "../../hooks/useAuth";
import CorrectionForm from "./CorrectionForm";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { toast } from "../../hooks/use-toast";

interface PointageDetailDrawerProps {
  pointage: Pointage | null;
  worker: Worker | null;
  activity: Activity | null;
  activities: Activity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export default function PointageDetailDrawer({
  pointage,
  worker,
  activity,
  activities,
  open,
  onOpenChange,
  onUpdated,
}: PointageDetailDrawerProps) {
  const { user } = useAuth();
  const [showCorrection, setShowCorrection] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const validateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/pointages/${id}/validate`),
    onSuccess: () => {
      toast({ title: "Pointage validé" });
      onUpdated();
      onOpenChange(false);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Validation échouée", description: String(message), variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api.patch(`/pointages/${id}/reject`, { rejectionReason }),
    onSuccess: () => {
      toast({ title: "Pointage rejeté" });
      onUpdated();
      onOpenChange(false);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Rejet échoué", description: String(message), variant: "destructive" });
    },
  });

  if (!pointage) return null;

  const canValidate = user?.role === "ADMIN" || user?.role === "CHEF_SERVICE";
  const canCorrect = user?.role === "ADMIN";
  const canActOnPending = pointage.status === "PENDING" || pointage.status === "NEEDS_CLARIFICATION";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setShowCorrection(false);
          setRejectReason("");
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Détail pointage</DialogTitle>
          <DialogDescription>
            {worker ? `${worker.firstName} ${worker.lastName}` : pointage.workerId} —{" "}
            {formatDate(pointage.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-md border ${
                pointage.photoKey ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <Camera className={`h-5 w-5 ${pointage.photoKey ? "text-emerald-700" : "text-zinc-400"}`} />
            </div>
            <div>
              <Badge variant={pointageStatusVariant(pointage.status)}>
                {POINTAGE_STATUS_LABELS[pointage.status]}
              </Badge>
              <p className="mt-1 text-sm text-zinc-600">
                {activity?.label ?? pointage.activityId} · {pointage.quantity}{" "}
                {activity?.unit ?? ""}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-zinc-500">Montant</dt>
              <dd className="font-medium">{formatPointageAmount(pointage.amount)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Tarif snapshot</dt>
              <dd>{formatPointageAmount(pointage.unitRateSnapshot)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Saisie terrain</dt>
              <dd>{formatDate(pointage.createdByClientAt)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Sync serveur</dt>
              <dd>{formatDate(pointage.syncedAt)}</dd>
            </div>
          </dl>

          {(pointage.geoLat != null || pointage.geoLng != null) && (
            <div className="flex items-start gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <div>
                <p className="font-medium text-zinc-900">Géolocalisation</p>
                <p className="text-zinc-600">
                  {pointage.geoLat?.toFixed(5)}, {pointage.geoLng?.toFixed(5)}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
            <p className="font-medium text-zinc-900">Biométrie (semaine)</p>
            {pointage.bioCheck ? (
              <p className="text-zinc-600">
                {pointage.bioCheck.result} — {formatDate(pointage.bioCheck.performedAt)}
              </p>
            ) : (
              <p className="text-zinc-500">Aucun contrôle bio pour cette semaine</p>
            )}
          </div>

          <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
            <p className="font-medium text-zinc-900">Historique validation</p>
            {pointage.validatedAt ? (
              <p className="text-zinc-600">Validé le {formatDate(pointage.validatedAt)}</p>
            ) : pointage.rejectionReason ? (
              <p className="text-red-700">Rejet : {pointage.rejectionReason}</p>
            ) : (
              <p className="text-zinc-500">Pas encore traité</p>
            )}
            {pointage.notes && <p className="mt-1 text-zinc-600">Notes : {pointage.notes}</p>}
          </div>

          {canValidate && canActOnPending && !showCorrection && (
            <div className="space-y-3 border-t border-zinc-200 pt-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => validateMutation.mutate(pointage.id)}
                  disabled={validateMutation.isPending}
                >
                  Valider
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    rejectReason.trim().length >= 3
                      ? rejectMutation.mutate({ id: pointage.id, rejectionReason: rejectReason.trim() })
                      : toast({
                          title: "Motif requis",
                          description: "Minimum 3 caractères",
                          variant: "destructive",
                        })
                  }
                  disabled={rejectMutation.isPending}
                >
                  Rejeter
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Motif de rejet</Label>
                <Input
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Motif (min. 3 caractères)"
                />
              </div>
            </div>
          )}

          {canCorrect && !showCorrection && (
            <Button type="button" variant="outline" onClick={() => setShowCorrection(true)}>
              Corriger
            </Button>
          )}

          {canCorrect && showCorrection && (
            <CorrectionForm
              pointage={pointage}
              activities={activities}
              onSuccess={() => {
                setShowCorrection(false);
                onUpdated();
                onOpenChange(false);
              }}
              onCancel={() => setShowCorrection(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
