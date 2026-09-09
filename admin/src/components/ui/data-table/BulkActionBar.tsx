import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../button";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  children: ReactNode;
}

/** Barre d'actions de lot — n'apparaît que si au moins une ligne est sélectionnée. */
export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-ring bg-brand-tint/40 px-4 py-2.5">
      <span className="text-sm font-medium text-zinc-900">
        {count} sélectionné{count > 1 ? "s" : ""}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        <X className="h-3.5 w-3.5" aria-hidden />
        Désélectionner
      </Button>
    </div>
  );
}
