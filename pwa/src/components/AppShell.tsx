import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "../lib/cn";
import { useAuth } from "../hooks/useAuth";
import { startAutoSync, stopAutoSync } from "../sync/SyncManager";
import SyncStatusBar from "./sync/SyncStatusBar";
import Button from "./ui/Button";

const CDE_LINKS = [
  { to: "/", label: "Activité" },
  { to: "/batch", label: "Saisie lot" },
  { to: "/nfc", label: "Présence" },
  { to: "/clarifications", label: "Précisions" },
  { to: "/teams", label: "Équipes" },
] as const;

const CDS_LINKS = [
  { to: "/validation", label: "Validation" },
  { to: "/daily-close", label: "Clôture" },
  { to: "/clarifications", label: "Précisions" },
  { to: "/activity-requests", label: "Activités" },
  { to: "/worker-requests", label: "Travailleurs" },
  { to: "/teams", label: "Équipes" },
] as const;

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isCde = user?.role === "CHEF_EQUIPE";
  const isCds = user?.role === "CHEF_SERVICE" || user?.role === "ADMIN";

  useEffect(() => {
    startAutoSync();
    return () => stopAutoSync();
  }, []);

  const roleLinks = isCde ? CDE_LINKS : isCds ? CDS_LINKS : [];
  const navLinks = [...roleLinks, { to: "/sync", label: "Synchronisation" }];

  function navClass(path: string): string {
    const active =
      location.pathname === path ||
      (path !== "/" && location.pathname.startsWith(`${path}/`));
    return cn(
      "inline-flex shrink-0 items-center whitespace-nowrap border-b-2 px-3 py-3 text-sm",
      "min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset",
      active
        ? "border-zinc-900 font-medium text-zinc-900"
        : "border-transparent text-zinc-600 hover:text-zinc-900",
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">ALTERRA Terrain</p>
          {user && (
            <p className="text-xs text-zinc-600">
              {user.firstName} {user.lastName}
            </p>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
          Déconnexion
        </Button>
      </header>

      <nav className="flex overflow-x-auto border-b border-zinc-200 bg-zinc-50 [-webkit-overflow-scrolling:touch]">
        {navLinks.map((link) => (
          <Link key={link.to} to={link.to} className={navClass(link.to)}>
            {link.label}
          </Link>
        ))}
      </nav>

      <SyncStatusBar />

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
