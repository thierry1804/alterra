-- Règle de pointage : un travailleur n'a qu'un seul pointage actif (non REJECTED) par jour (une seule
-- équipe, une seule activité). Index partiel de sécurité contre les saisies concurrentes ; le contrôle
-- principal est applicatif (sync.service / correction.service).
--
-- Borné aux dates >= 2026-11-13 : la base contient 11 couples (travailleur, jour) historiques déjà en
-- double sur deux activités (2026-10-17 et 2026-11-12, dont des pointages VALIDATED potentiellement
-- payés) qu'on ne réécrit pas automatiquement. Retirer la borne une fois ces doublons traités.
CREATE UNIQUE INDEX "pointage_one_active_per_worker_day"
ON "Pointage" ("workerId", "date")
WHERE "status" <> 'REJECTED' AND "date" >= DATE '2026-11-13';
