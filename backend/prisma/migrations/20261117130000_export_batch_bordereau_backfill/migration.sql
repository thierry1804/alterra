UPDATE "MvolaExportBatch" b
SET "bordereauId" = x."bordereauId"
FROM (
  SELECT "exportBatchId", (array_agg("bordereauId"))[1] AS "bordereauId"
  FROM "Payment"
  WHERE "exportBatchId" IS NOT NULL AND "bordereauId" IS NOT NULL
  GROUP BY "exportBatchId"
  HAVING COUNT(DISTINCT "bordereauId") = 1
) x
WHERE b."id" = x."exportBatchId" AND b."bordereauId" IS NULL;
