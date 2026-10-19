import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { IconClose } from "../icons";

interface ContextHelpProps {
  id: string;
  title: string;
  children: React.ReactNode;
  /** Conservé pour compatibilité : l'aide n'est plus affichée d'office. */
  persistDismiss?: boolean;
}

/**
 * Aide contextuelle : un bouton « ? » discret qui ouvre une feuille en bas d'écran.
 * Elle ne prend plus de place dans la page tant qu'on ne la demande pas.
 */
export default function ContextHelp({ id, title, children }: ContextHelpProps) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={`Aide : ${title}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          "alterra-focus inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-600",
          "hover:bg-zinc-50 active:bg-zinc-100",
        )}
      >
        ?
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fermer l'aide"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-zinc-900/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`help-${id}`}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-zinc-200 bg-white p-4 shadow-lg"
            style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
              <p id={`help-${id}`} className="text-base font-semibold text-zinc-900">
                {title}
              </p>
              <button
                ref={closeRef}
                type="button"
                aria-label="Fermer l'aide"
                onClick={() => setOpen(false)}
                className="alterra-focus -mr-1 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-700">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

export function GlossaryTerm({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="font-medium text-zinc-900">{term}</span> — {children}
    </p>
  );
}
