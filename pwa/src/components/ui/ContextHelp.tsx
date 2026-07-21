import { useState } from "react";
import { cn } from "../../lib/cn";
import Button from "./Button";

interface ContextHelpProps {
  id: string;
  title: string;
  children: React.ReactNode;
  persistDismiss?: boolean;
}

function isDismissed(id: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`alterra-help-${id}`) === "1";
}

function dismissHelp(id: string): void {
  window.localStorage.setItem(`alterra-help-${id}`, "1");
}

export default function ContextHelp({
  id,
  title,
  children,
  persistDismiss = true,
}: ContextHelpProps) {
  const [open, setOpen] = useState(() => !(persistDismiss && isDismissed(id)));

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`Aide : ${title}`}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-xs font-medium text-zinc-600",
          "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
        )}
      >
        ?
      </button>
    );
  }

  function handleClose() {
    setOpen(false);
    if (persistDismiss) dismissHelp(id);
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-zinc-900">{title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
          Fermer
        </Button>
      </div>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </div>
  );
}

export function GlossaryTerm({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="font-medium text-zinc-900">{term}</span> — {children}
    </p>
  );
}
