-- Un seul pointage actif (non REJECTED) par (travailleur, sous-activité, jour) : empêche le double
-- comptage au paiement quand deux saisies concurrentes (deux appareils) ou une resoumission après
-- rejet créent chacune une ligne pour le même créneau. Index partiel : l'historique des pointages
-- REJECTED pour un même créneau reste illimité.
CREATE UNIQUE INDEX "pointage_active_slot_unique"
ON "Pointage" ("workerId", "subActivityId", "date")
WHERE "status" <> 'REJECTED';
