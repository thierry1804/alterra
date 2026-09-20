import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { TableCell, TableRow } from "./table";

interface QueryErrorProps {
  /** Ce qui n'a pas pu être chargé, au pluriel : « les sites », « le journal d'audit »… */
  what: string;
  onRetry: () => void;
}

/** État d'erreur d'une requête : dit ce qui a échoué et propose de réessayer. */
export function QueryError({ what, onRetry }: QueryErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-900">Impossible de charger {what}</p>
        <p className="mx-auto max-w-sm text-sm text-muted">
          Le serveur n'a pas répondu comme prévu. Vérifiez votre connexion, puis rechargez.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={onRetry}>
        Recharger
      </Button>
    </div>
  );
}

/** Même état d'erreur, en ligne pleine largeur dans un tableau. */
export function TableQueryError({ colSpan, ...props }: QueryErrorProps & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <QueryError {...props} />
      </TableCell>
    </TableRow>
  );
}
