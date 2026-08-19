import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-brand", className)} aria-hidden />;
}

/** Ligne de chargement centrée pour un conteneur (registre, panneau). */
export function LoadingRow({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

/** État d'erreur inline avec action de reprise. */
export function ErrorState({
  title = "Impossible de charger les données",
  hint,
  onRetry,
}: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center" role="alert">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        {hint && <p className="mx-auto max-w-sm text-sm text-muted">{hint}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="alterra-focus rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-xs transition-colors hover:bg-zinc-50"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
