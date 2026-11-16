ALTER TABLE "Bordereau" ADD COLUMN "financeValidatedById" UUID;
ALTER TABLE "Bordereau" ADD COLUMN "financeValidatedAt" TIMESTAMP(3);
ALTER TABLE "Bordereau" ADD COLUMN "dgValidatedById" UUID;
ALTER TABLE "Bordereau" ADD COLUMN "dgValidatedAt" TIMESTAMP(3);
ALTER TABLE "Bordereau" ADD COLUMN "returnReason" TEXT;
ALTER TABLE "Bordereau" ADD COLUMN "returnedById" UUID;
ALTER TABLE "Bordereau" ADD COLUMN "returnedAt" TIMESTAMP(3);
ALTER TABLE "Bordereau" ADD COLUMN "lines" JSONB;

-- Validation finance (G31) et validation DG (G32) : une personne ne peut pas cumuler les deux sur un même bordereau (contrôle serveur) et aucun rôle ne porte les deux groupes.
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000031', 'bordereau:valider_finance');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000032', 'bordereau:valider_dg');
