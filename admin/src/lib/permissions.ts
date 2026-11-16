import type { AuthUser } from "./auth-store";

export interface Access {
  all?: readonly string[];
  any?: readonly string[];
}

export function hasPermission(user: AuthUser | null | undefined, key: string): boolean {
  return Boolean(user?.permissions.includes(key));
}

export function canAccess(user: AuthUser | null | undefined, access: Access): boolean {
  if (!user) return false;
  const allOk = (access.all ?? []).every((key) => user.permissions.includes(key));
  const anyOk = !access.any || access.any.some((key) => user.permissions.includes(key));
  return allOk && anyOk;
}
