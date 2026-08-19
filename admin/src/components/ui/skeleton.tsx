import { cn } from "../../lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shimmer rounded-md bg-zinc-200/80", className)}
      aria-hidden
      {...props}
    />
  );
}

/** Lignes de skeleton pour un tableau en chargement (registre dense). */
export function TableRowsSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-zinc-200">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-3 py-3">
              <Skeleton className={cn("h-4", c === 0 ? "w-8" : c === cols - 1 ? "w-16" : "w-24")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
