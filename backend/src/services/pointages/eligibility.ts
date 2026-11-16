import type { Prisma } from "@prisma/client";

export const BORDEREAU_ELIGIBLE: Prisma.PointageWhereInput = {
  status: "VALIDATED",
  technicalValidatedAt: { not: null },
};
