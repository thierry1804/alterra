import { useCallback } from "react";
import { useAuthStore } from "../lib/auth-store";
import { hasPermission } from "../lib/permissions";

export function useCan(): (key: string) => boolean {
  const user = useAuthStore((state) => state.user);
  return useCallback((key: string) => hasPermission(user, key), [user]);
}
