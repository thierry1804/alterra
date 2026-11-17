ALTER TABLE "Bordereau" ADD COLUMN "exportedAt" TIMESTAMP(3);
ALTER TABLE "Bordereau" ADD COLUMN "exportedById" UUID;

ALTER TABLE "MvolaExportBatch" ADD COLUMN "bordereauId" UUID;
CREATE INDEX "MvolaExportBatch_bordereauId_idx" ON "MvolaExportBatch"("bordereauId");
ALTER TABLE "MvolaExportBatch" ADD CONSTRAINT "MvolaExportBatch_bordereauId_fkey" FOREIGN KEY ("bordereauId") REFERENCES "Bordereau"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Le retour MVola (import du relevé) devient un groupe à part, pour pouvoir le confier à la trésorerie sans lui donner la gestion des paiements.
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000041', 'Retour MVola — import', true, CURRENT_TIMESTAMP);
DELETE FROM "GroupPermission" WHERE "groupId" = '00000000-0000-0000-000a-000000000025' AND "permissionKey" = 'paiement:import_statut';
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000041', 'paiement:import_statut');

-- L'administrateur détient tous les groupes (y compris les deux validations de bordereau) ; la trésorerie reçoit l'import du retour MVola.
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000031');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000032');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000041');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000007', '00000000-0000-0000-000a-000000000041');
