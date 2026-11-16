import type { AccessScope } from "@prisma/client";
import type { AccessTokenPayload } from "../../lib/jwt.js";

export interface AuthUser extends AccessTokenPayload {
  scope: AccessScope;
  permissions: ReadonlySet<string>;
  roleName: string;
  mfaRequired: boolean;
}
