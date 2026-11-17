import type { AuthUser } from "../services/access/auth-user.js";

export function visibleSiteId(user: AuthUser, requested?: string): string | undefined | null {
  if (user.scope === "TOUS") return requested;
  if (!user.siteId) return null;
  if (requested && requested !== user.siteId) return null;
  return user.siteId;
}

export function canSeeSite(user: AuthUser, siteId: string): boolean {
  return user.scope === "TOUS" || user.siteId === siteId;
}
