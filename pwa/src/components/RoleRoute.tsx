import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface RoleRouteProps {
  allowedRoles: Array<"ADMIN" | "CHEF_SERVICE" | "CHEF_EQUIPE">;
}

export default function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { user, bootstrapped } = useAuth();

  if (!bootstrapped) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-zinc-600">
        Chargement…
      </div>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    if (user?.role === "CHEF_SERVICE") {
      return <Navigate to="/validation" replace />;
    }
    if (user?.role === "CHEF_EQUIPE") {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/sync" replace />;
  }

  return <Outlet />;
}
