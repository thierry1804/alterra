import { Navigate, Outlet } from "react-router-dom";
import type { AuthUser } from "../../lib/auth-store";
import { useAuth } from "../../hooks/useAuth";

interface RoleGuardProps {
  allowedRoles: AuthUser["role"][];
}

export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
