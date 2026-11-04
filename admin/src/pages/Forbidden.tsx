import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "../hooks/useAuth";

export default function Forbidden() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Hors de AppLayout (un utilisateur sans accès ne doit pas voir le menu) : pas de Topbar, donc pas
  // de bouton de déconnexion ailleurs. Un rôle non autorisé ici (ex. CHEF_EQUIPE) rebondit sur cette
  // page depuis chaque route de l'admin — sans ce bouton, il n'a aucune issue possible.
  // Cette page est aussi hors de ProtectedRoute : rien ne redirige automatiquement une fois déconnecté,
  // il faut naviguer explicitement vers /login.
  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Accès refusé</h1>
      <p className="max-w-md text-sm text-zinc-600">
        Votre rôle ne permet pas d&apos;accéder à cette page.
      </p>
      <div className="flex gap-2">
        {user?.role === "ADMIN" || user?.role === "CHEF_SERVICE" ? (
          <Button asChild variant="outline">
            <Link to="/">Retour au tableau de bord</Link>
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => void handleSignOut()}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
