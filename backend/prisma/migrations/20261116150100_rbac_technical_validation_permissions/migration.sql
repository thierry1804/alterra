-- Permissions de validation technique, de synthèse et de visibilité des montants (P1-04 / P1-05).
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000005', 'pointage:valider_technique');
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000006', 'pointage:synthese');

-- Groupe « montants » : tous les rôles qui voient aujourd'hui les montants le gardent, sauf le responsable technique et la trésorerie.
INSERT INTO "PermissionGroup" ("id", "name", "isSystem", "updatedAt") VALUES ('00000000-0000-0000-000a-000000000040', 'Pointages — montants', true, CURRENT_TIMESTAMP);
INSERT INTO "GroupPermission" ("groupId", "permissionKey") VALUES ('00000000-0000-0000-000a-000000000040', 'pointage:voir_montants');

INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000040');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000040');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000003', '00000000-0000-0000-000a-000000000040');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000005', '00000000-0000-0000-000a-000000000040');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000006', '00000000-0000-0000-000a-000000000040');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000008', '00000000-0000-0000-000a-000000000040');

-- L'administrateur garde la validation technique (et les synthèses) tant que le responsable technique n'est pas en place ; le chef de service voit les synthèses de son site.
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000005');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000a-000000000006');
INSERT INTO "AccessRoleGroup" ("roleId", "groupId") VALUES ('00000000-0000-0000-000b-000000000002', '00000000-0000-0000-000a-000000000006');
