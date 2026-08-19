import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { roleLabel } from "../../lib/navigation";
import { Button } from "../ui/button";

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-white text-zinc-900">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-people-bg text-[11px] font-semibold uppercase text-people-fg"
              aria-hidden
            >
              {user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}` : "—"}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium text-zinc-900">
                {user ? `${user.firstName} ${user.lastName}` : "—"}
              </span>
              {user?.role && (
                <span className="block truncate text-xs text-subtle">{roleLabel(user.role)}</span>
              )}
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
            Déconnexion
          </Button>
        </header>
        <main className="flex-1 overflow-auto bg-surface/40 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
