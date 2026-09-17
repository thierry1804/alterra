-- Regroupement des sous-activités par tâche : la ligne globale (siteId NULL) et ses
-- surcharges par site partagent le même groupKey. Backfill : chaque lignée existante
-- (categoryId + label + shortLabel + unitId + siteId, à travers ses versions RG-04)
-- reçoit le même groupKey, dérivé de l'id de sa plus ancienne version.
ALTER TABLE "ActivitySubActivity" ADD COLUMN "groupKey" UUID;

UPDATE "ActivitySubActivity" a
SET "groupKey" = lineage."groupKey"
FROM (
  SELECT DISTINCT ON ("categoryId", label, "shortLabel", "unitId", "siteId")
    "categoryId", label, "shortLabel", "unitId", "siteId", id AS "groupKey"
  FROM "ActivitySubActivity"
  ORDER BY "categoryId", label, "shortLabel", "unitId", "siteId", "validFrom" ASC
) lineage
WHERE a."categoryId" = lineage."categoryId"
  AND a.label = lineage.label
  AND a."shortLabel" = lineage."shortLabel"
  AND a."unitId" = lineage."unitId"
  AND a."siteId" IS NOT DISTINCT FROM lineage."siteId";

ALTER TABLE "ActivitySubActivity" ALTER COLUMN "groupKey" SET NOT NULL;

CREATE INDEX "ActivitySubActivity_groupKey_idx" ON "ActivitySubActivity" ("groupKey");

-- Au plus une ligne "courante" (non close) par site dans un même groupe.
CREATE UNIQUE INDEX "ActivitySubActivity_groupKey_siteId_current_key"
  ON "ActivitySubActivity" ("groupKey", "siteId")
  NULLS NOT DISTINCT
  WHERE "validTo" IS NULL;
