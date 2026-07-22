import { basePrisma } from "./prisma-base.js";
import { createRlsExtension } from "../middleware/prisma-rls.js";

// @ts-expect-error — dynamic RLS query extension map is built at runtime
const extendedPrisma = basePrisma.$extends(createRlsExtension(basePrisma));

export type AppPrisma = typeof extendedPrisma;
export const prisma: AppPrisma = extendedPrisma;

export { basePrisma };
