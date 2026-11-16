import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { canAccess, type Access } from "../lib/permissions";
import { homePathFor } from "./nav/nav-config";

interface PermissionRouteProps {
  access: Access;
}

export default function PermissionRoute({ access }: PermissionRouteProps) {
  const { user, bootstrapped } = useAuth();

  if (!bootstrapped) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-zinc-600">
        Chargement…
      </div>
    );
  }

  if (!canAccess(user, access)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <Outlet />;
}
