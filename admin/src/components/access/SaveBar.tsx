import { Button } from "../ui/button";

interface SaveBarProps {
  count: number;
  busy?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/** Barre collante en bas de page : visible tant que des modifications ne sont pas enregistrées. */
export default function SaveBar({ count, busy = false, onSave, onCancel }: SaveBarProps) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Modifications non enregistrées"
      className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-overlay backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm font-medium text-zinc-900">
          {count} modification{count > 1 ? "s" : ""} non enregistrée{count > 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Annuler
          </Button>
          <Button type="button" disabled={busy} onClick={onSave}>
            Enregistrer…
          </Button>
        </div>
      </div>
    </div>
  );
}
