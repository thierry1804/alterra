import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { startAutoSync, stopAutoSync } from "../sync/SyncManager";
import SyncStatusBar from "./sync/SyncStatusBar";

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isCde = user?.role === "CHEF_EQUIPE";
  const isCds = user?.role === "CHEF_SERVICE" || user?.role === "ADMIN";

  useEffect(() => {
    startAutoSync();
    return () => stopAutoSync();
  }, []);

  function navClass(path: string): string {
    const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
    return active
      ? "border-b-2 border-zinc-900 px-4 py-2 text-sm font-medium text-zinc-900"
      : "px-4 py-2 text-sm text-zinc-700";
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">ALTERRA Terrain</p>
          {user && (
            <p className="text-xs text-zinc-500">
              {user.firstName} {user.lastName}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="text-xs text-zinc-600 underline"
        >
          Déconnexion
        </button>
      </header>

      <nav className="flex border-b border-zinc-200 bg-zinc-50">
        {isCde && (
          <>
            <Link to="/" className={navClass("/")}>
              Activité
            </Link>
            <Link to="/batch" className={navClass("/batch")}>
              Saisie lot
            </Link>
            <Link to="/teams" className={navClass("/teams")}>
              Équipes
            </Link>
          </>
        )}
        {isCds && (
          <>
            <Link to="/validation" className={navClass("/validation")}>
              Validation
            </Link>
            <Link to="/teams" className={navClass("/teams")}>
              Équipes
            </Link>
          </>
        )}
        <Link to="/sync" className={navClass("/sync")}>
          Sync
        </Link>
      </nav>

      <SyncStatusBar />

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
