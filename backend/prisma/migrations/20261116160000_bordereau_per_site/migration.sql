CREATE TYPE "BordereauStatus" AS ENUM ('GENERATED', 'FINANCE_VALIDATED', 'DG_VALIDATED', 'EXPORTED', 'SUPERSEDED');

CREATE TABLE "Bordereau" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "siteId" UUID NOT NULL,
    "periodIso" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "number" INTEGER NOT NULL,
    "status" "BordereauStatus" NOT NULL DEFAULT 'GENERATED',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    CONSTRAINT "Bordereau_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment" ADD COLUMN "bordereauId" UUID;
ALTER TABLE "Pointage" ADD COLUMN "bordereauId" UUID;

CREATE UNIQUE INDEX "Bordereau_siteId_periodIso_referenceYear_version_key" ON "Bordereau"("siteId", "periodIso", "referenceYear", "version");
CREATE INDEX "Bordereau_siteId_status_idx" ON "Bordereau"("siteId", "status");
CREATE INDEX "Bordereau_periodIso_referenceYear_idx" ON "Bordereau"("periodIso", "referenceYear");
CREATE INDEX "Payment_bordereauId_idx" ON "Payment"("bordereauId");
CREATE INDEX "Pointage_bordereauId_idx" ON "Pointage"("bordereauId");

ALTER TABLE "Bordereau" ADD CONSTRAINT "Bordereau_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bordereauId_fkey" FOREIGN KEY ("bordereauId") REFERENCES "Bordereau"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_bordereauId_fkey" FOREIGN KEY ("bordereauId") REFERENCES "Bordereau"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TEMP TABLE "_bordereau_legacy" AS
SELECT
  gen_random_uuid() AS id,
  w."siteId" AS "siteId",
  p."periodIso" AS "periodIso",
  COALESCE(p."referenceYear", EXTRACT(YEAR FROM p."createdAt")::int) AS "referenceYear",
  p."bordereau" AS number,
  CASE WHEN bool_or(p."status" IN ('EXPORTED', 'PAID')) THEN 'EXPORTED' ELSE 'GENERATED' END AS status,
  MIN(p."createdAt") AS "createdAt"
FROM "Payment" p
JOIN "Worker" w ON w."id" = p."workerId"
GROUP BY w."siteId", p."periodIso", COALESCE(p."referenceYear", EXTRACT(YEAR FROM p."createdAt")::int), p."bordereau";

INSERT INTO "Bordereau" ("id", "siteId", "periodIso", "referenceYear", "version", "number", "status", "createdAt")
SELECT
  id, "siteId", "periodIso", "referenceYear",
  ROW_NUMBER() OVER (PARTITION BY "siteId", "periodIso", "referenceYear" ORDER BY number),
  number, status::"BordereauStatus", "createdAt"
FROM "_bordereau_legacy";

UPDATE "Payment" p
SET "bordereauId" = l.id
FROM "_bordereau_legacy" l, "Worker" w
WHERE w."id" = p."workerId"
  AND l."siteId" = w."siteId"
  AND l."periodIso" = p."periodIso"
  AND l."referenceYear" = COALESCE(p."referenceYear", EXTRACT(YEAR FROM p."createdAt")::int)
  AND l.number = p."bordereau";

UPDATE "Pointage" pt
SET "bordereauId" = sub."bordereauId"
FROM (
  SELECT DISTINCT ON (pt2."id") pt2."id" AS "pointageId", p."bordereauId" AS "bordereauId"
  FROM "Pointage" pt2
  JOIN "Payment" p ON p."workerId" = pt2."workerId" AND p."bordereauId" IS NOT NULL
  WHERE pt2."status" = 'VALIDATED'
    AND pt2."bordereauId" IS NULL
    AND pt2."date" BETWEEN
      CASE WHEN p."periodIso" LIKE 'D%'
        THEN make_date(COALESCE(p."referenceYear", EXTRACT(YEAR FROM p."createdAt")::int), 1, 1) + (SUBSTRING(p."periodIso" FROM 2)::int - 1)
        ELSE to_date(COALESCE(p."referenceYear", EXTRACT(YEAR FROM p."createdAt")::int)::text || '-' || SUBSTRING(p."periodIso" FROM 2) || '-1', 'IYYY-IW-ID')
      END
      AND
      CASE WHEN p."periodIso" LIKE 'D%'
        THEN make_date(COALESCE(p."referenceYear", EXTRACT(YEAR FROM p."createdAt")::int), 1, 1) + (SUBSTRING(p."periodIso" FROM 2)::int - 1)
        ELSE to_date(COALESCE(p."referenceYear", EXTRACT(YEAR FROM p."createdAt")::int)::text || '-' || SUBSTRING(p."periodIso" FROM 2) || '-1', 'IYYY-IW-ID') + 6
      END
  ORDER BY pt2."id"
) sub
WHERE pt."id" = sub."pointageId";

-- Permissions bordereaux : lecture (G29) et génération (G30, nouveau). L'administrateur détient les deux ; la génération peut être confiée à un autre rôle depuis l'écran des rôles.
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000029', 'bordereau:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000030', 'Bordereaux — génération', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000030', 'bordereau:generation');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000029');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000030');
