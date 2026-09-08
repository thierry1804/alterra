-- Un code (ex: "ACT04") doit être unique par site parmi les activités
-- actives. Index unique partiel : n'empêche pas la réutilisation d'un code
-- sur une ancienne version fermée (RG-04, applyActivityRateChange) ni sur
-- un autre site. NULL siteId (activités globales) : chaque NULL est traité
-- comme distinct par Postgres, donc pas d'unicité inter-sites forcée ici.
CREATE UNIQUE INDEX "Activity_siteId_code_active_key"
  ON "Activity" ("siteId", "code")
  WHERE "active" = true AND "code" IS NOT NULL;
