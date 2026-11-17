CREATE TYPE "ParcelleKind" AS ENUM ('PARCELLE', 'PEPINIERE');

ALTER TABLE "Parcelle" ADD COLUMN "kind" "ParcelleKind" NOT NULL DEFAULT 'PARCELLE';

-- Le chef d'équipe et le chef de service choisissent la zone et la parcelle (ou la pépinière) à la saisie : lecture des zones et parcelles (G14).
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000014');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000014');
