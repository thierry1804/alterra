import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function GuestRoute() {
  const { isAuthenticated, bootstrapped } = useAuth();
  if (!bootstrapped) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function ProtectedRoute() {
  const { isAuthenticated, bootstrapped } = useAuth();
  const location = useLocation();

  if (!bootstrapped) return <LoadingScreen />;
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
