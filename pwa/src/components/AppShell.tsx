import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAppSettings } from "../hooks/useAppSettings";
import { startAutoSync, stopAutoSync } from "../sync/SyncManager";
import SyncStatusBar, { SyncPill } from "./sync/SyncStatusBar";
import RejectedBanner from "./sync/RejectedBanner";
import ClarificationBanner from "./sync/ClarificationBanner";
import BottomNav from "./nav/BottomNav";
import MoreSheet from "./nav/MoreSheet";
import NotificationBell from "./notifications/NotificationBell";
import { navForRole } from "./nav/nav-config";
import { useOpenClarificationsCount } from "../hooks/useOpenClarificationsCount";

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
  const openClarifications = useOpenClarificationsCount();
  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "";

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
        <div className="flex items-center gap-2 px-4 py-2">
          <img src={iconUrl} alt={appName} className="h-9 w-auto shrink-0" />
          <div className="flex-1" />
          <SyncPill />
          <NotificationBell />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Profil de ${user ? `${user.firstName} ${user.lastName}` : "l'utilisateur"}`}
            className="alterra-focus grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white active:bg-brand-hover"
          >
            {initials || "?"}
          </button>
        </div>
        <div className="alterra-rule h-0.5" aria-hidden="true" />
        <SyncStatusBar />
        <RejectedBanner />
        <ClarificationBanner />
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
        badges={{ "/clarifications": openClarifications }}
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
