import { basePrisma } from "./prisma-base.js";
import { createRlsExtension } from "../middleware/prisma-rls.js";

export const prisma = basePrisma.$extends(createRlsExtension(basePrisma));

export { basePrisma };
