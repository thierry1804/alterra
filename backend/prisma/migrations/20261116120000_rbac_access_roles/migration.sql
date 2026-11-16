-- CreateEnum
CREATE TYPE "AccessScope" AS ENUM ('TOUS', 'SITE', 'EQUIPE');

-- CreateTable
CREATE TABLE "AccessRole" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "scope" "AccessScope" NOT NULL,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGroup" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupPermission" (
    "groupId" UUID NOT NULL,
    "permissionKey" TEXT NOT NULL,

    CONSTRAINT "GroupPermission_pkey" PRIMARY KEY ("groupId","permissionKey")
);

-- CreateTable
CREATE TABLE "AccessRoleGroup" (
    "roleId" UUID NOT NULL,
    "groupId" UUID NOT NULL,

    CONSTRAINT "AccessRoleGroup_pkey" PRIMARY KEY ("roleId","groupId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_name_key" ON "AccessRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroup_name_key" ON "PermissionGroup"("name");

-- CreateIndex
CREATE INDEX "AccessRoleGroup_groupId_idx" ON "AccessRoleGroup"("groupId");

-- AddForeignKey
ALTER TABLE "GroupPermission" ADD CONSTRAINT "GroupPermission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRoleGroup" ADD CONSTRAINT "AccessRoleGroup_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRoleGroup" ADD CONSTRAINT "AccessRoleGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rôles et groupes système (droits équivalents à l'ancien enum "Role")
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000001', 'Saisie des pointages', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000001', 'pointage:saisie');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000002', 'Pointages — consultation', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000002', 'pointage:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000003', 'Pointages — validation site', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000003', 'pointage:valider_site');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000003', 'biometrie:verifier_en_ligne');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000004', 'Pointages — correction', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000004', 'pointage:correction');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000007', 'Tableau de bord', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000007', 'tableau_bord:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000008', 'Équipes — consultation et membres', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000008', 'equipe:lecture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000008', 'equipe:membres');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000009', 'Équipes — gestion', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000009', 'equipe:ecriture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000010', 'Travailleurs — consultation', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000010', 'travailleur:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000011', 'Travailleurs — gestion', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000011', 'travailleur:ecriture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000011', 'travailleur:suppression');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000011', 'travailleur:import');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000012', 'Référentiels — consultation', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000012', 'site:lecture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000012', 'activite:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000013', 'Référentiels — gestion', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000013', 'site:ecriture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000013', 'site:suppression');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000013', 'activite:ecriture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000013', 'activite:suppression');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000014', 'Zones et parcelles — consultation', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000014', 'zone:lecture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000014', 'parcelle:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000015', 'Zones et parcelles — gestion', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000015', 'zone:ecriture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000015', 'zone:suppression');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000015', 'parcelle:ecriture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000015', 'parcelle:suppression');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000016', 'Badges — consultation', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000016', 'badge:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000017', 'Badges — gestion', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000017', 'badge:ecriture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000018', 'Biométrie — gabarits (gestion)', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000018', 'biometrie:gabarits_ecriture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000019', 'Demandes — création et suivi', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000019', 'demande:lecture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000019', 'demande:creer');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000019', 'demande:annuler');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000019', 'precision:lecture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000019', 'precision:creer');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000019', 'precision:cloturer');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000020', 'Demandes — décision', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000020', 'demande:decider');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000021', 'Précisions — réponse terrain', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000021', 'precision:lecture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000021', 'precision:repondre');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000022', 'Rapports opérationnels', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000022', 'rapport:generation');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000023', 'Rapports d''analyse', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000023', 'rapport:analyse');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000024', 'Paiements — consultation', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000024', 'paiement:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000025', 'Paiements — gestion', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000025', 'paiement:generation');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000025', 'paiement:correction');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000025', 'paiement:suppression');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000025', 'paiement:import_statut');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000026', 'Export MVola', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000026', 'paiement:export');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000027', 'Factures — consultation', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000027', 'facture:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000028', 'Factures — génération', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000028', 'facture:generation');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000033', 'Utilisateurs — gestion', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000033', 'utilisateur:lecture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000033', 'utilisateur:ecriture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000034', 'Rôles — administration', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000034', 'role:gerer');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000034', 'utilisateur:affecter_role');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000035', 'Audit', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000035', 'audit:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000036', 'Paramètres', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000036', 'parametres:ecriture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000037', 'Système — sauvegarde et restauration', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000037', 'systeme:sauvegarde');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000037', 'systeme:restauration');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000038', 'Carte', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000038', 'carte:lecture');
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000039', 'Présence et biométrie terrain', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000039', 'presence:saisie');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000039', 'presence:lecture');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000039', 'biometrie:verifier_hors_ligne');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000039', 'biometrie:gabarits_lecture');
INSERT INTO "AccessRole" ("id", "name", "description", "isSystem", "scope", "mfaRequired", "updatedAt") VALUES ('00000000-0000-0000-000b-000000000001', 'Administrateur', 'Accès complet à tous les sites', true, 'TOUS', true, CURRENT_TIMESTAMP);
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000001');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000039');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000002');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000003');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000004');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000007');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000008');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000009');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000010');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000011');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000012');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000013');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000014');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000015');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000016');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000017');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000018');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000019');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000020');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000021');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000022');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000023');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000024');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000025');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000026');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000027');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000028');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000033');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000034');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000035');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000036');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000037');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000038');
INSERT INTO "AccessRole" ("id", "name", "description", "isSystem", "scope", "mfaRequired", "updatedAt") VALUES ('00000000-0000-0000-000b-000000000002', 'Chef de service', 'Pilote un site : validation des pointages, équipes, demandes', true, 'SITE', false, CURRENT_TIMESTAMP);
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000001');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000039');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000002');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000003');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000007');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000008');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000009');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000010');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000012');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000016');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000017');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000019');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000022');
INSERT INTO "AccessRole" ("id", "name", "description", "isSystem", "scope", "mfaRequired", "updatedAt") VALUES ('00000000-0000-0000-000b-000000000003', 'Chef d''équipe', 'Saisie terrain pour son équipe', true, 'EQUIPE', false, CURRENT_TIMESTAMP);
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000001');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000039');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000002');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000008');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000010');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000012');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000016');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000021');

-- AlterTable : chaque utilisateur reprend le rôle système équivalent à son ancien rôle
ALTER TABLE "User" ADD COLUMN "accessRoleId" UUID;

UPDATE "User" SET "accessRoleId" = CASE "role"::text
    WHEN 'ADMIN' THEN '00000000-0000-0000-000b-000000000001'::uuid
    WHEN 'CHEF_SERVICE' THEN '00000000-0000-0000-000b-000000000002'::uuid
    WHEN 'CHEF_EQUIPE' THEN '00000000-0000-0000-000b-000000000003'::uuid
END;

ALTER TABLE "User" ALTER COLUMN "accessRoleId" SET NOT NULL;

-- DropIndex
DROP INDEX "User_role_siteId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE INDEX "User_accessRoleId_siteId_idx" ON "User"("accessRoleId", "siteId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

