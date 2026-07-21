import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Accès refusé</h1>
      <p className="max-w-md text-sm text-zinc-600">
        Votre rôle ne permet pas d&apos;accéder à cette page.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
