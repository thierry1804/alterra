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
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-6">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-600">
              {user ? `${user.firstName} ${user.lastName}` : "—"}
              {user?.role ? ` · ${roleLabel(user.role)}` : ""}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
            Déconnexion
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
