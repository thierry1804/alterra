import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { Hint } from "../tooltip";
import { TableHead } from "../table";
import { cn } from "../../../lib/utils";

interface SortableHeadProps {
  sortKey: string;
  label: string;
  currentKey: string | null;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
  numeric?: boolean;
  className?: string;
  /** Aide courte affichée dans une infobulle (survol et focus clavier). Requiert un TooltipProvider. */
  hint?: string;
}

/** En-tête de colonne cliquable pour trier — même rendu que TableHead, plus l'indicateur ▲▼. */
export function SortableHead({
  sortKey,
  label,
  currentKey,
  currentDir,
  onSort,
  numeric,
  className,
  hint,
}: SortableHeadProps) {
  const active = currentKey === sortKey;
  return (
    <TableHead numeric={numeric} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "alterra-focus inline-flex items-center gap-1 rounded-sm text-left hover:text-zinc-900",
          active && "text-zinc-900",
        )}
      >
        {label}
        {active ? (
          currentDir === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" aria-hidden />
        )}
      </button>
      {hint && (
        <Hint label={hint} side="top">
          <button
            type="button"
            aria-label={`Aide : ${label}`}
            className="alterra-focus ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-subtle hover:text-zinc-900"
          >
            <Info className="h-3 w-3" aria-hidden />
          </button>
        </Hint>
      )}
    </TableHead>
  );
}
