import { PrismaClient } from "@prisma/client";

/** Raw Prisma client — used internally for audit writes and bypassing extensions. */
export const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
