-- Groupes dédiés aux fonctions à venir (validation technique, synthèses, bordereaux) : vides pour l'instant,
-- les permissions y seront ajoutées par les migrations des tickets correspondants.
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000005', 'Pointages — validation technique', true, CURRENT_TIMESTAMP);
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000006', 'Synthèses', true, CURRENT_TIMESTAMP);
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000029', 'Bordereaux — consultation', true, CURRENT_TIMESTAMP);
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000031', 'Bordereaux — validation finance', true, CURRENT_TIMESTAMP);
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000032', 'Bordereaux — validation DG', true, CURRENT_TIMESTAMP);

-- Rôles de la matrice du cahier (P1-03), rattachés aux groupes existants et aux groupes dédiés
INSERT INTO "AccessRole" ("id", "name", "description", "isSystem", "scope", "mfaRequired", "updatedAt") VALUES ('00000000-0000-0000-000b-000000000004', 'Responsable technique forestier', 'Valide globalement les pointages, sans accès financier', true, 'TOUS', false, CURRENT_TIMESTAMP);
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000004', '00000000-0000-0000-000a-000000000002');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000004', '00000000-0000-0000-000a-000000000010');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000004', '00000000-0000-0000-000a-000000000012');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000004', '00000000-0000-0000-000a-000000000014');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000004', '00000000-0000-0000-000a-000000000005');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000004', '00000000-0000-0000-000a-000000000006');
INSERT INTO "AccessRole" ("id", "name", "description", "isSystem", "scope", "mfaRequired", "updatedAt") VALUES ('00000000-0000-0000-000b-000000000005', 'Finance', 'Première validation des bordereaux', true, 'TOUS', true, CURRENT_TIMESTAMP);
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000005', '00000000-0000-0000-000a-000000000007');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000005', '00000000-0000-0000-000a-000000000027');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000005', '00000000-0000-0000-000a-000000000006');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000005', '00000000-0000-0000-000a-000000000029');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000005', '00000000-0000-0000-000a-000000000031');
INSERT INTO "AccessRole" ("id", "name", "description", "isSystem", "scope", "mfaRequired", "updatedAt") VALUES ('00000000-0000-0000-000b-000000000006', 'DG', 'Deuxième validation des bordereaux', true, 'TOUS', true, CURRENT_TIMESTAMP);
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000006', '00000000-0000-0000-000a-000000000007');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000006', '00000000-0000-0000-000a-000000000027');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000006', '00000000-0000-0000-000a-000000000006');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000006', '00000000-0000-0000-000a-000000000029');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000006', '00000000-0000-0000-000a-000000000032');
INSERT INTO "AccessRole" ("id", "name", "description", "isSystem", "scope", "mfaRequired", "updatedAt") VALUES ('00000000-0000-0000-000b-000000000007', 'Trésorerie', 'Export vers MVola des bordereaux validés', true, 'TOUS', true, CURRENT_TIMESTAMP);
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000007', '00000000-0000-0000-000a-000000000026');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000007', '00000000-0000-0000-000a-000000000027');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000007', '00000000-0000-0000-000a-000000000029');
INSERT INTO "AccessRole" ("id", "name", "description", "isSystem", "scope", "mfaRequired", "updatedAt") VALUES ('00000000-0000-0000-000b-000000000008', 'Consultation', 'Lecture et analyse, tous sites', true, 'TOUS', false, CURRENT_TIMESTAMP);
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000008', '00000000-0000-0000-000a-000000000002');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000008', '00000000-0000-0000-000a-000000000007');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000008', '00000000-0000-0000-000a-000000000012');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000008', '00000000-0000-0000-000a-000000000023');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000008', '00000000-0000-0000-000a-000000000027');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000008', '00000000-0000-0000-000a-000000000006');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000008', '00000000-0000-0000-000a-000000000029');
