import { cn } from "../../lib/cn";
import { IconSync } from "../icons";

export function Spinner({ className }: { className?: string }) {
  return <IconSync className={cn("h-5 w-5 animate-spin text-brand", className)} />;
}

/** Écran de chargement plein — remplace le « Chargement… » texte. */
export function LoadingScreen({ label = "Chargement…" }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-sm text-zinc-600"
      role="status"
    >
      <Spinner className="h-6 w-6" />
      <span>{label}</span>
    </div>
  );
}

/** État vide sobre qui oriente l'utilisateur. */
export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-8 text-center text-sm text-zinc-600">
      {children}
    </div>
  );
}
