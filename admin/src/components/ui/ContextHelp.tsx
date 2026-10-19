import { useState } from "react";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";

interface ContextHelpProps {
  id: string;
  title: string;
  children: React.ReactNode;
  /** Conservé pour compatibilité : l'aide n'est plus affichée d'office. */
  persistDismiss?: boolean;
}

/** Aide contextuelle : un bouton « ? » qui ouvre une fenêtre, au lieu d'un encart permanent. */
export default function ContextHelp({ id, title, children }: ContextHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`Aide : ${title}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600",
          "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1",
        )}
      >
        ?
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={`help-${id}`}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Définitions utiles pour cet écran.
            </DialogDescription>
          </DialogHeader>
          <div id={`help-${id}`} className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-700">
            {children}
          </div>
        </DialogContent>
      </Dialog>
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
