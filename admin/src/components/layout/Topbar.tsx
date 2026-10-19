import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, ChevronRight, LogOut, Search } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useNavCounts } from "../../hooks/useNavCounts";
import { navTrail, roleLabel } from "../../lib/navigation";
import SiteSelect from "./SiteSelect";

interface TopbarProps {
  onOpenPalette: () => void;
}

export default function Topbar({ onOpenPalette }: TopbarProps) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const counts = useNavCounts();
  const trail = navTrail(pathname);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const todo = user?.role === "ADMIN" ? counts.requests + counts.pointages : counts.pointages;
  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "—";

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-6">
      <nav
        aria-label="Fil d'Ariane"
        className="flex min-w-0 items-center gap-1.5 text-sm text-muted"
      >
        {trail && (
          <>
            <span className="hidden sm:inline">{trail.section}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden />
            <span className="truncate font-semibold text-zinc-900">{trail.label}</span>
          </>
        )}
      </nav>

      <div className="flex-1" />

      {user?.role === "ADMIN" && <SiteSelect />}

      <button
        type="button"
        onClick={onOpenPalette}
        className="alterra-focus hidden min-w-[16rem] items-center gap-2 rounded-lg border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-muted hover:border-zinc-300 md:flex"
        aria-label="Rechercher une page ou une action"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 text-left">Rechercher une page, une action</span>
        <kbd className="rounded border border-zinc-200 bg-white px-1.5 text-[0.6875rem] font-medium">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        onClick={onOpenPalette}
        className="alterra-focus grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-700 md:hidden"
        aria-label="Rechercher une page ou une action"
      >
        <Search className="h-4 w-4" aria-hidden />
      </button>

      <Link
        to={user?.role === "ADMIN" ? "/requests" : "/pointages"}
        className="alterra-focus relative grid h-9 w-9 place-items-center rounded-full border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
        aria-label={todo > 0 ? `${todo} élément(s) à traiter` : "Rien à traiter"}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {todo > 0 && (
          <span className="alterra-num absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--color-earth)] px-1 text-[0.625rem] font-bold text-white">
            {todo > 99 ? "99+" : todo}
          </span>
        )}
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Profil de ${user ? `${user.firstName} ${user.lastName}` : "l'utilisateur"}`}
          className="alterra-focus grid h-9 w-9 place-items-center rounded-full bg-brand text-xs font-bold text-white hover:bg-brand-hover"
        >
          {initials}
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-11 z-dropdown w-60 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-overlay"
          >
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-zinc-900">
                {user ? `${user.firstName} ${user.lastName}` : "—"}
              </p>
              {user?.role && <p className="text-xs text-muted">{roleLabel(user.role)}</p>}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              className="alterra-focus flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
