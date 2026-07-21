import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { hasPersistedSession, hasPinConfigured } from "../lib/session";
import { useEffect, useState } from "react";

export function GuestRoute() {
  const { isAuthenticated, bootstrapped } = useAuth();
  if (!bootstrapped) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function ProtectedRoute() {
  const { isAuthenticated, isLocked, needsPinSetup, bootstrapped } = useAuth();
  const location = useLocation();
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void Promise.all([hasPinConfigured(), hasPersistedSession()]).then(([pin, session]) => {
      setPersisted(pin && session);
    });
  }, []);

  if (!bootstrapped || persisted === null) return <LoadingScreen />;

  if (needsPinSetup) {
    return <Navigate to="/unlock?setup=1" replace state={{ from: location }} />;
  }

  if (isLocked && persisted) {
    return <Navigate to="/unlock" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-full items-center justify-center text-sm text-zinc-600">
      Chargement…
    </div>
  );
}
