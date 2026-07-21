import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import type {
  ActivityRequestRow,
  ClarificationRequestRow,
  WorkerRequestRow,
} from "../../lib/workflows";
import {
  CLARIFICATION_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  clarificationStatusVariant,
  complementActivityRequest,
  complementWorkerRequest,
  decideActivityRequest,
  decideWorkerRequest,
  requestStatusVariant,
} from "../../lib/workflows";
import { formatDate } from "../../lib/referentials";
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

export type RequestSelection =
  | { type: "activity"; row: ActivityRequestRow }
  | { type: "worker"; row: WorkerRequestRow }
  | { type: "clarification"; row: ClarificationRequestRow };

interface RequestDetailDrawerProps {
  selection: RequestSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export default function RequestDetailDrawer({
  selection,
  open,
  onOpenChange,
  onUpdated,
}: RequestDetailDrawerProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [complementComment, setComplementComment] = useState("");
  const [actionMode, setActionMode] = useState<"none" | "reject" | "complement">("none");

  const approveMutation = useMutation({
    mutationFn: async (payload: { type: "activity" | "worker"; id: string }) => {
      if (payload.type === "activity") {
        return decideActivityRequest(payload.id, "APPROVED");
      }
      return decideWorkerRequest(payload.id, "APPROVED");
    },
    onSuccess: () => {
      toast({ title: "Demande acceptée" });
      resetForms();
      onUpdated();
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: "Acceptation échouée",
        description: errorMessage(err),
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (payload: { type: "activity" | "worker"; id: string; reason: string }) => {
      if (payload.type === "activity") {
        return decideActivityRequest(payload.id, "REJECTED", payload.reason);
      }
      return decideWorkerRequest(payload.id, "REJECTED", payload.reason);
    },
    onSuccess: () => {
      toast({ title: "Demande refusée" });
      resetForms();
      onUpdated();
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: "Refus échoué",
        description: errorMessage(err),
        variant: "destructive",
      });
    },
  });

  const complementMutation = useMutation({
    mutationFn: async (payload: { type: "activity" | "worker"; id: string; comment: string }) => {
      if (payload.type === "activity") {
        return complementActivityRequest(payload.id, payload.comment);
      }
      return complementWorkerRequest(payload.id, payload.comment);
    },
    onSuccess: () => {
      toast({ title: "Complément envoyé au demandeur" });
      resetForms();
      onUpdated();
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: "Envoi du complément échoué",
        description: errorMessage(err),
        variant: "destructive",
      });
    },
  });

  function resetForms() {
    setRejectReason("");
    setComplementComment("");
    setActionMode("none");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForms();
    onOpenChange(nextOpen);
  }

  if (!selection) return null;

  const isDecidable =
    selection.type !== "clarification" && selection.row.status === "PENDING";
  const busy =
    approveMutation.isPending || rejectMutation.isPending || complementMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selection.type === "activity" && "Demande d'activité"}
            {selection.type === "worker" && "Demande MOC"}
            {selection.type === "clarification" && "Demande de précisions"}
          </DialogTitle>
          <DialogDescription>
            Créée le {formatDate(selection.row.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selection.type === "activity" && (
            <>
              <DetailField label="Libellé proposé" value={selection.row.proposedLabel} />
              <DetailField
                label="Unité / tarif"
                value={`${selection.row.proposedUnit} · ${Number(selection.row.proposedRate).toLocaleString("fr-MG")} Ar`}
              />
              <DetailField label="Justification" value={selection.row.justification} />
              <StatusBadge
                label={REQUEST_STATUS_LABELS[selection.row.status]}
                variant={requestStatusVariant(selection.row.status)}
              />
            </>
          )}

          {selection.type === "worker" && (
            <>
              <DetailField
                label="Identité"
                value={`${selection.row.firstName} ${selection.row.lastName}`}
              />
              <DetailField label="MVola" value={selection.row.mvolaNumber} />
              {selection.row.cinNumber && (
                <DetailField label="CIN" value={selection.row.cinNumber} />
              )}
              <DetailField label="Justification" value={selection.row.justification} />
              {selection.row.proposedPhotoKey && (
                <DetailField label="Photo" value="Photo jointe à la demande" />
              )}
              <StatusBadge
                label={REQUEST_STATUS_LABELS[selection.row.status]}
                variant={requestStatusVariant(selection.row.status)}
              />
            </>
          )}

          {selection.type === "clarification" && (
            <>
              <DetailField label="Pointage" value={selection.row.pointageId} />
              <DetailField label="Question" value={selection.row.question} />
              {selection.row.requestedPhoto && (
                <DetailField label="Photo demandée" value="Oui" />
              )}
              {selection.row.answerText && (
                <DetailField label="Réponse CDE" value={selection.row.answerText} />
              )}
              <StatusBadge
                label={CLARIFICATION_STATUS_LABELS[selection.row.status]}
                variant={clarificationStatusVariant(selection.row.status)}
              />
            </>
          )}

          {(selection.type === "activity" || selection.type === "worker") &&
            selection.row.decisionReason && (
              <DetailField label="Commentaire admin" value={selection.row.decisionReason} />
            )}

          {isDecidable && (
            <div className="space-y-3 border-t border-zinc-200 pt-4">
              <p className="text-sm font-medium text-zinc-900">Décision</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    approveMutation.mutate({ type: selection.type, id: selection.row.id })
                  }
                >
                  Accepter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setActionMode(actionMode === "reject" ? "none" : "reject")}
                >
                  Refuser
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    setActionMode(actionMode === "complement" ? "none" : "complement")
                  }
                >
                  Complément
                </Button>
              </div>

              {actionMode === "reject" && (
                <div className="space-y-2">
                  <Label htmlFor="reject-reason">Motif de refus</Label>
                  <Input
                    id="reject-reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Minimum 3 caractères"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy || rejectReason.trim().length < 3}
                    onClick={() =>
                      rejectMutation.mutate({
                        type: selection.type,
                        id: selection.row.id,
                        reason: rejectReason.trim(),
                      })
                    }
                  >
                    Confirmer le refus
                  </Button>
                </div>
              )}

              {actionMode === "complement" && (
                <div className="space-y-2">
                  <Label htmlFor="complement-comment">Demande de complément</Label>
                  <Input
                    id="complement-comment"
                    value={complementComment}
                    onChange={(event) => setComplementComment(event.target.value)}
                    placeholder="Précisez ce qui manque…"
                  />
                  <Button
                    type="button"
                    disabled={busy || complementComment.trim().length < 3}
                    onClick={() =>
                      complementMutation.mutate({
                        type: selection.type,
                        id: selection.row.id,
                        comment: complementComment.trim(),
                      })
                    }
                  >
                    Envoyer le complément
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-900">{value}</p>
    </div>
  );
}

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "default" | "success" | "warning" | "danger";
}) {
  return <Badge variant={variant}>{label}</Badge>;
}

function errorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    return String(err.response?.data?.message ?? "Erreur");
  }
  return "Erreur";
}
