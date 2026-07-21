import { FormEvent, useEffect, useRef, useState } from "react";
import Button from "./Button";

interface RejectDialogProps {
  open: boolean;
  workerName: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export default function RejectDialog({
  open,
  workerName,
  busy = false,
  onConfirm,
  onCancel,
}: RejectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setReason("");
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Le motif doit contenir au moins 3 caractères.");
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(100%,24rem)] rounded-lg border border-zinc-200 bg-white p-0 shadow-lg backdrop:bg-black/40"
      onClose={onCancel}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Rejeter le pointage</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Motif pour {workerName}. Cette action est définitive.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="reject-reason" className="text-sm font-medium text-zinc-700">
            Motif de rejet
          </label>
          <textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder="Ex. quantité incorrecte, absence non justifiée…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            autoFocus
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" variant="destructive" disabled={busy}>
            {busy ? "Rejet…" : "Confirmer le rejet"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
