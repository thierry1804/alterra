import { ApiError } from "../../middleware/error-handler.js";
import type { AuthUser } from "../access/auth-user.js";

export function assertBordereauSite(user: AuthUser, siteId: string): void {
  if (user.scope === "TOUS") return;
  if (!user.siteId || user.siteId !== siteId) {
    throw new ApiError(403, "FORBIDDEN_SITE", "Ce site est hors de votre périmètre");
  }
}
