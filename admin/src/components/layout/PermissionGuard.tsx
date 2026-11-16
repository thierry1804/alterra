import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { accessForPath, navItemsForUser } from "../../lib/navigation";
import { canAccess } from "../../lib/permissions";

interface PermissionGuardProps {
  path: string;
  children: ReactElement;
}

export default function PermissionGuard({ path, children }: PermissionGuardProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const access = accessForPath(path);
  if (!access || !canAccess(user, access)) {
    const fallback = path === "/" ? navItemsForUser(user)[0] : undefined;
    return <Navigate to={fallback ? fallback.path : "/forbidden"} replace />;
  }

  return children;
}
