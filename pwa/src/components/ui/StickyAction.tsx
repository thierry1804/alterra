import type { ReactNode } from "react";

/**
 * Barre d'action collée au-dessus de la navigation du bas : une seule action principale par écran.
 * Réserve sa propre hauteur dans le flux pour ne rien masquer.
 */
export default function StickyAction({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-20" aria-hidden="true" />
      <div
        className="fixed inset-x-0 z-20 px-4 pb-3"
        style={{ bottom: "calc(var(--bottom-nav-h) + var(--safe-area-bottom))" }}
      >
        {children}
      </div>
    </>
  );
}
