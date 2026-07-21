import { basePrisma } from "./prisma-base.js";
import { createAuditExtension } from "../middleware/audit.interceptor.js";
import { createRlsExtension } from "../middleware/prisma-rls.js";

export const prisma = basePrisma
  .$extends(createRlsExtension())
  .$extends(createAuditExtension(basePrisma));

export { basePrisma };
