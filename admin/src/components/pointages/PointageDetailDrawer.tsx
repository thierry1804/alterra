import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Camera, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { api } from "../../lib/api";
import type { Pointage } from "../../lib/pointages";
import {
  POINTAGE_STATUS_LABELS,
  formatPointageAmount,
  pointageStatusVariant,
} from "../../lib/pointages";
import type { ActivitySubActivity, Worker } from "../../lib/referentials";
import { formatDate } from "../../lib/referentials";
import { useAuth } from "../../hooks/useAuth";
import CorrectionForm from "./CorrectionForm";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Dialog, DialogContent } from "../ui/dialog";
import { toast } from "../../hooks/use-toast";

interface PointageDetailDrawerProps {
  pointage: Pointage | null;
  worker: Worker | null;
  subActivity: ActivitySubActivity | null;
  subActivities: ActivitySubActivity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export default function PointageDetailDrawer({
  pointage,
  worker,
  subActivity,
  subActivities,
  open,
  onOpenChange,
  onUpdated,
  onNavigate,
  hasPrev,
  hasNext,
}: PointageDetailDrawerProps) {
  const { user } = useAuth();
  const [showCorrection, setShowCorrection] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);

  const rejectReasonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowCorrection(false);
    setRejectReason("");
    setPhotoOpen(false);
  }, [pointage?.id]);

  const canValidate = user?.role === "ADMIN" || user?.role === "CHEF_SERVICE";
  const canActOnPending =
    pointage?.status === "PENDING" || pointage?.status === "NEEDS_CLARIFICATION";
  // Un pointage validé est potentiellement déjà payé — plus aucune action (valider/rejeter/corriger)
  // ne doit pouvoir le modifier. Un rejeté reste corrigeable : c'est le seul chemin de réparation.
  const canCorrect = user?.role === "ADMIN" && pointage?.status !== "VALIDATED";

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

  useEffect(() => {
    if (!open || !pointage) return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }
      if (e.key === "ArrowUp" && hasPrev && onNavigate) onNavigate("prev");
      if (e.key === "ArrowDown" && hasNext && onNavigate) onNavigate("next");

      const key = e.key.toLowerCase();
      if (key === "v" && canValidate && canActOnPending && !showCorrection) {
        validateMutation.mutate(pointage!.id);
      }
      if (key === "r" && canValidate && canActOnPending && !showCorrection) {
        rejectReasonRef.current?.focus();
      }
      if (key === "c" && canCorrect) {
        setShowCorrection((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    pointage,
    onNavigate,
    hasPrev,
    hasNext,
    canValidate,
    canCorrect,
    canActOnPending,
    showCorrection,
    validateMutation,
  ]);

  const photoQuery = useQuery({
    queryKey: ["pointage-photo", pointage?.id],
    queryFn: async () => {
      const res = await api.get(`/pointages/${pointage!.id}/photo`, { responseType: "blob" });
      return URL.createObjectURL(res.data as Blob);
    },
    enabled: open && !!pointage?.photoKey,
    staleTime: Infinity,
    gcTime: 0,
  });

  const lastPhotoUrl = useRef<string | null>(null);
  useEffect(() => {
    if (photoQuery.data && photoQuery.data !== lastPhotoUrl.current) {
      if (lastPhotoUrl.current) URL.revokeObjectURL(lastPhotoUrl.current);
      lastPhotoUrl.current = photoQuery.data;
    }
  }, [photoQuery.data]);
  useEffect(
    () => () => {
      if (lastPhotoUrl.current) URL.revokeObjectURL(lastPhotoUrl.current);
    },
    [],
  );

  if (!pointage) return null;

  function submitReject() {
    if (rejectReason.trim().length >= 3) {
      rejectMutation.mutate({ id: pointage!.id, rejectionReason: rejectReason.trim() });
    } else {
      rejectReasonRef.current?.focus();
      toast({
        title: "Motif requis",
        description: "Minimum 3 caractères",
        variant: "destructive",
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>Détail pointage</SheetTitle>
            {onNavigate && (
              <div className="ml-1 flex items-center gap-0.5">
                <IconButton
                  icon={ChevronUp}
                  label="Pointage précédent"
                  size="sm"
                  disabled={!hasPrev}
                  onClick={() => onNavigate("prev")}
                />
                <IconButton
                  icon={ChevronDown}
                  label="Pointage suivant"
                  size="sm"
                  disabled={!hasNext}
                  onClick={() => onNavigate("next")}
                />
              </div>
            )}
          </div>
          <SheetDescription>
            {worker ? `${worker.firstName} ${worker.lastName}` : pointage.workerId} —{" "}
            {formatDate(pointage.date)}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <div className="flex items-center gap-3">
            {pointage.photoKey ? (
              photoQuery.data ? (
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1"
                >
                  <img
                    src={photoQuery.data}
                    alt="Photo du pointage"
                    className="h-12 w-12 cursor-zoom-in rounded-md border border-emerald-200 object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-md border border-emerald-200 bg-emerald-50">
                  <Camera className="h-5 w-5 text-emerald-700" />
                </div>
              )
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50">
                <Camera className="h-5 w-5 text-zinc-400" />
              </div>
            )}
            <div>
              <Badge variant={pointageStatusVariant(pointage.status)}>
                {POINTAGE_STATUS_LABELS[pointage.status]}
              </Badge>
              <p className="mt-1 text-sm text-zinc-600">
                {subActivity?.label ?? pointage.subActivityId} · {pointage.quantity}{" "}
                {subActivity?.unit?.label ?? ""}
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

          {pointage.status === "VALIDATED" && (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              Pointage validé (potentiellement payé) — verrouillé, aucune modification possible.
            </p>
          )}

          {canValidate && canActOnPending && !showCorrection && (
            <div className="space-y-3 border-t border-zinc-200 pt-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => validateMutation.mutate(pointage.id)}
                  disabled={validateMutation.isPending}
                >
                  Valider <kbd className="ml-1.5 rounded border border-current/30 px-1 text-[10px] font-mono opacity-70">V</kbd>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={submitReject}
                  disabled={rejectMutation.isPending}
                >
                  Rejeter <kbd className="ml-1.5 rounded border border-current/30 px-1 text-[10px] font-mono opacity-70">R</kbd>
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Motif de rejet</Label>
                <Input
                  ref={rejectReasonRef}
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitReject();
                  }}
                  placeholder="Motif (min. 3 caractères)"
                />
              </div>
            </div>
          )}

          {canCorrect && !showCorrection && (
            <Button type="button" variant="outline" onClick={() => setShowCorrection(true)}>
              Corriger <kbd className="ml-1.5 rounded border border-current/30 px-1 text-[10px] font-mono opacity-70">C</kbd>
            </Button>
          )}

          {canCorrect && showCorrection && (
            <CorrectionForm
              pointage={pointage}
              subActivities={subActivities}
              onSuccess={() => {
                setShowCorrection(false);
                onUpdated();
                onOpenChange(false);
              }}
              onCancel={() => setShowCorrection(false)}
            />
          )}
        </SheetBody>
      </SheetContent>

      {photoQuery.data && (
        <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
          <DialogContent className="max-w-2xl p-2">
            <img
              src={photoQuery.data}
              alt="Photo du pointage en grand"
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </Sheet>
  );
}
