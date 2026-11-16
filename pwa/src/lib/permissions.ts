import type { AuthUser } from "./session";

export interface Access {
  all?: readonly string[];
  scopes?: ReadonlyArray<AuthUser["scope"]>;
}

export function hasPermission(user: AuthUser | null | undefined, key: string): boolean {
  return Boolean(user?.permissions.includes(key));
}

export function canAccess(user: AuthUser | null | undefined, access: Access): boolean {
  if (!user) return false;
  const permissionsOk = (access.all ?? []).every((key) => user.permissions.includes(key));
  const scopeOk = !access.scopes || access.scopes.includes(user.scope);
  return permissionsOk && scopeOk;
}
