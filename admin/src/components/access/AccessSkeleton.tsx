import { Skeleton } from "../ui/skeleton";

/** Squelette de la page Rôles et groupes pendant le premier chargement. */
export function AccessPageSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Chargement des rôles">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-px overflow-hidden rounded-lg border border-zinc-200">
        <Skeleton className="h-8 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 border-t border-zinc-100 px-3 py-3">
            <div className="w-64 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-6 w-11 rounded-full" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
