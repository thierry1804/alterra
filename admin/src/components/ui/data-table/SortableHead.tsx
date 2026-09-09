import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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
    </TableHead>
  );
}
