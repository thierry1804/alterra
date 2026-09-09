import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAppSettings } from "../hooks/useAppSettings";
import { startAutoSync, stopAutoSync } from "../sync/SyncManager";
import SyncStatusBar from "./sync/SyncStatusBar";
import BottomNav from "./nav/BottomNav";
import MoreSheet from "./nav/MoreSheet";
import { isActivePath, navForRole } from "./nav/nav-config";

export default function AppShell() {
  const { user, logout } = useAuth();
  const { appName, iconUrl } = useAppSettings();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    startAutoSync();
    return () => stopAutoSync();
  }, []);

  // Close the sheet whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const { primary, more } = navForRole(user?.role);
  const moreActive = more.some((item) => isActivePath(location.pathname, item.to));

  const roleLabel =
    user?.role === "CHEF_EQUIPE"
      ? "Chef d'équipe"
      : user?.role === "CHEF_SERVICE"
        ? "Chef de service"
        : user?.role === "ADMIN"
          ? "Administration"
          : "";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 bg-white">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <img src={iconUrl} alt={appName} className="h-9 w-auto shrink-0" />
          <div className="min-w-0 border-l border-zinc-200 pl-3 leading-tight">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand">
              Terrain
            </p>
            {user && (
              <p className="truncate text-xs text-zinc-600">
                {user.firstName} {user.lastName}
                {roleLabel && <span className="text-zinc-400"> · {roleLabel}</span>}
              </p>
            )}
          </div>
        </div>
        <div className="alterra-rule h-0.5" aria-hidden="true" />
        <SyncStatusBar />
      </header>

      <main
        className="flex-1"
        style={{ paddingBottom: "calc(var(--bottom-nav-h) + var(--safe-area-bottom))" }}
      >
        <Outlet />
      </main>

      <BottomNav
        items={primary}
        currentPath={location.pathname}
        moreActive={moreActive}
        onOpenMore={() => setMoreOpen(true)}
      />

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={more}
        currentPath={location.pathname}
        userName={user ? `${user.firstName} ${user.lastName}` : ""}
        roleLabel={roleLabel}
        onLogout={() => void logout()}
      />
    </div>
  );
}
