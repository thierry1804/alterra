import type { PermissionKey } from "./permissions.catalog.js";

export type AccessScopeValue = "TOUS" | "SITE" | "EQUIPE";

export interface SystemGroup {
  id: string;
  code: string;
  name: string;
  permissions: readonly PermissionKey[];
}

export interface SystemRole {
  id: string;
  code:
    | "ADMIN"
    | "CHEF_SERVICE"
    | "CHEF_EQUIPE"
    | "RESPONSABLE_TECHNIQUE"
    | "FINANCE"
    | "DG"
    | "TRESORERIE"
    | "CONSULTATION";
  name: string;
  description: string;
  scope: AccessScopeValue;
  mfaRequired: boolean;
  groups: readonly string[];
}

function groupId(n: number): string {
  return `00000000-0000-0000-000a-${String(n).padStart(12, "0")}`;
}

export const SYSTEM_GROUPS: readonly SystemGroup[] = [
  { id: groupId(1), code: "G01", name: "Saisie des pointages", permissions: ["pointage:saisie"] },
  {
    id: groupId(2),
    code: "G02",
    name: "Pointages — consultation",
    permissions: ["pointage:lecture"],
  },
  {
    id: groupId(3),
    code: "G03",
    name: "Pointages — validation site",
    permissions: ["pointage:valider_site", "biometrie:verifier_en_ligne"],
  },
  {
    id: groupId(4),
    code: "G04",
    name: "Pointages — correction",
    permissions: ["pointage:correction"],
  },
  {
    id: groupId(5),
    code: "G05",
    name: "Pointages — validation technique",
    permissions: ["pointage:valider_technique"],
  },
  { id: groupId(6), code: "G06", name: "Synthèses", permissions: ["pointage:synthese"] },
  { id: groupId(7), code: "G07", name: "Tableau de bord", permissions: ["tableau_bord:lecture"] },
  {
    id: groupId(8),
    code: "G08",
    name: "Équipes — consultation et membres",
    permissions: ["equipe:lecture", "equipe:membres"],
  },
  { id: groupId(9), code: "G09", name: "Équipes — gestion", permissions: ["equipe:ecriture"] },
  {
    id: groupId(10),
    code: "G10",
    name: "Travailleurs — consultation",
    permissions: ["travailleur:lecture"],
  },
  {
    id: groupId(11),
    code: "G11",
    name: "Travailleurs — gestion",
    permissions: ["travailleur:ecriture", "travailleur:suppression", "travailleur:import"],
  },
  {
    id: groupId(12),
    code: "G12",
    name: "Référentiels — consultation",
    permissions: ["site:lecture", "activite:lecture"],
  },
  {
    id: groupId(13),
    code: "G13",
    name: "Référentiels — gestion",
    permissions: ["site:ecriture", "site:suppression", "activite:ecriture", "activite:suppression"],
  },
  {
    id: groupId(14),
    code: "G14",
    name: "Zones et parcelles — consultation",
    permissions: ["zone:lecture", "parcelle:lecture"],
  },
  {
    id: groupId(15),
    code: "G15",
    name: "Zones et parcelles — gestion",
    permissions: ["zone:ecriture", "zone:suppression", "parcelle:ecriture", "parcelle:suppression"],
  },
  { id: groupId(16), code: "G16", name: "Badges — consultation", permissions: ["badge:lecture"] },
  { id: groupId(17), code: "G17", name: "Badges — gestion", permissions: ["badge:ecriture"] },
  {
    id: groupId(18),
    code: "G18",
    name: "Biométrie — gabarits (gestion)",
    permissions: ["biometrie:gabarits_ecriture"],
  },
  {
    id: groupId(19),
    code: "G19",
    name: "Demandes — création et suivi",
    permissions: [
      "demande:lecture",
      "demande:creer",
      "demande:annuler",
      "precision:lecture",
      "precision:creer",
      "precision:cloturer",
    ],
  },
  { id: groupId(20), code: "G20", name: "Demandes — décision", permissions: ["demande:decider"] },
  {
    id: groupId(21),
    code: "G21",
    name: "Précisions — réponse terrain",
    permissions: ["precision:lecture", "precision:repondre"],
  },
  {
    id: groupId(22),
    code: "G22",
    name: "Rapports opérationnels",
    permissions: ["rapport:generation"],
  },
  { id: groupId(23), code: "G23", name: "Rapports d'analyse", permissions: ["rapport:analyse"] },
  {
    id: groupId(24),
    code: "G24",
    name: "Paiements — consultation",
    permissions: ["paiement:lecture"],
  },
  {
    id: groupId(25),
    code: "G25",
    name: "Paiements — gestion",
    permissions: ["paiement:generation", "paiement:correction", "paiement:suppression"],
  },
  { id: groupId(26), code: "G26", name: "Export MVola", permissions: ["paiement:export"] },
  {
    id: groupId(41),
    code: "G41",
    name: "Retour MVola — import",
    permissions: ["paiement:import_statut"],
  },
  {
    id: groupId(27),
    code: "G27",
    name: "Factures — consultation",
    permissions: ["facture:lecture"],
  },
  {
    id: groupId(28),
    code: "G28",
    name: "Factures — génération",
    permissions: ["facture:generation"],
  },
  {
    id: groupId(40),
    code: "G40",
    name: "Pointages — montants",
    permissions: ["pointage:voir_montants"],
  },
  {
    id: groupId(29),
    code: "G29",
    name: "Bordereaux — consultation",
    permissions: ["bordereau:lecture"],
  },
  {
    id: groupId(30),
    code: "G30",
    name: "Bordereaux — génération",
    permissions: ["bordereau:generation"],
  },
  {
    id: groupId(31),
    code: "G31",
    name: "Bordereaux — validation finance",
    permissions: ["bordereau:valider_finance"],
  },
  {
    id: groupId(32),
    code: "G32",
    name: "Bordereaux — validation DG",
    permissions: ["bordereau:valider_dg"],
  },
  {
    id: groupId(33),
    code: "G33",
    name: "Utilisateurs — gestion",
    permissions: ["utilisateur:lecture", "utilisateur:ecriture"],
  },
  {
    id: groupId(34),
    code: "G34",
    name: "Rôles — administration",
    permissions: ["role:gerer", "utilisateur:affecter_role"],
  },
  { id: groupId(35), code: "G35", name: "Audit", permissions: ["audit:lecture"] },
  { id: groupId(36), code: "G36", name: "Paramètres", permissions: ["parametres:ecriture"] },
  {
    id: groupId(37),
    code: "G37",
    name: "Système — sauvegarde et restauration",
    permissions: ["systeme:sauvegarde", "systeme:restauration"],
  },
  { id: groupId(38), code: "G38", name: "Carte", permissions: ["carte:lecture"] },
  {
    id: groupId(39),
    code: "G39",
    name: "Présence et biométrie terrain",
    permissions: [
      "presence:saisie",
      "presence:lecture",
      "biometrie:verifier_hors_ligne",
      "biometrie:gabarits_lecture",
    ],
  },
];

export const SYSTEM_ROLE_IDS = {
  ADMIN: "00000000-0000-0000-000b-000000000001",
  CHEF_SERVICE: "00000000-0000-0000-000b-000000000002",
  CHEF_EQUIPE: "00000000-0000-0000-000b-000000000003",
  RESPONSABLE_TECHNIQUE: "00000000-0000-0000-000b-000000000004",
  FINANCE: "00000000-0000-0000-000b-000000000005",
  DG: "00000000-0000-0000-000b-000000000006",
  TRESORERIE: "00000000-0000-0000-000b-000000000007",
  CONSULTATION: "00000000-0000-0000-000b-000000000008",
} as const;

export const SYSTEM_ROLES: readonly SystemRole[] = [
  {
    id: SYSTEM_ROLE_IDS.ADMIN,
    code: "ADMIN",
    name: "Administrateur",
    description: "Accès complet à tous les sites",
    scope: "TOUS",
    mfaRequired: true,
    groups: [
      "G01",
      "G39",
      "G02",
      "G03",
      "G04",
      "G07",
      "G08",
      "G09",
      "G10",
      "G11",
      "G12",
      "G13",
      "G14",
      "G15",
      "G16",
      "G17",
      "G18",
      "G19",
      "G20",
      "G21",
      "G22",
      "G23",
      "G24",
      "G25",
      "G26",
      "G27",
      "G28",
      "G33",
      "G34",
      "G35",
      "G36",
      "G37",
      "G38",
      "G05",
      "G06",
      "G40",
      "G29",
      "G30",
      "G31",
      "G32",
      "G41",
    ],
  },
  {
    id: SYSTEM_ROLE_IDS.CHEF_SERVICE,
    code: "CHEF_SERVICE",
    name: "Chef de service",
    description: "Pilote un site : validation des pointages, équipes, demandes",
    scope: "SITE",
    mfaRequired: false,
    groups: [
      "G01",
      "G39",
      "G02",
      "G03",
      "G07",
      "G08",
      "G09",
      "G10",
      "G12",
      "G14",
      "G16",
      "G17",
      "G19",
      "G22",
      "G06",
      "G40",
    ],
  },
  {
    id: SYSTEM_ROLE_IDS.CHEF_EQUIPE,
    code: "CHEF_EQUIPE",
    name: "Chef d'équipe",
    description: "Saisie terrain pour son équipe",
    scope: "EQUIPE",
    mfaRequired: false,
    groups: ["G01", "G39", "G02", "G08", "G10", "G12", "G14", "G16", "G21", "G40"],
  },
  {
    id: SYSTEM_ROLE_IDS.RESPONSABLE_TECHNIQUE,
    code: "RESPONSABLE_TECHNIQUE",
    name: "Responsable technique forestier",
    description: "Valide globalement les pointages, sans accès financier",
    scope: "TOUS",
    mfaRequired: false,
    groups: ["G02", "G10", "G12", "G14", "G05", "G06"],
  },
  {
    id: SYSTEM_ROLE_IDS.FINANCE,
    code: "FINANCE",
    name: "Finance",
    description: "Première validation des bordereaux",
    scope: "TOUS",
    mfaRequired: true,
    groups: ["G07", "G27", "G06", "G29", "G31", "G40"],
  },
  {
    id: SYSTEM_ROLE_IDS.DG,
    code: "DG",
    name: "DG",
    description: "Deuxième validation des bordereaux",
    scope: "TOUS",
    mfaRequired: true,
    groups: ["G07", "G27", "G06", "G29", "G32", "G40"],
  },
  {
    id: SYSTEM_ROLE_IDS.TRESORERIE,
    code: "TRESORERIE",
    name: "Trésorerie",
    description: "Export vers MVola des bordereaux validés",
    scope: "TOUS",
    mfaRequired: true,
    groups: ["G26", "G27", "G29", "G41"],
  },
  {
    id: SYSTEM_ROLE_IDS.CONSULTATION,
    code: "CONSULTATION",
    name: "Consultation",
    description: "Lecture et analyse, tous sites",
    scope: "TOUS",
    mfaRequired: false,
    groups: ["G02", "G07", "G12", "G23", "G27", "G06", "G29", "G40"],
  },
];

export function systemRolePermissions(roleId: string): ReadonlySet<PermissionKey> {
  const role = SYSTEM_ROLES.find((entry) => entry.id === roleId);
  const permissions = new Set<PermissionKey>();
  if (!role) return permissions;
  for (const code of role.groups) {
    const group = SYSTEM_GROUPS.find((entry) => entry.code === code);
    group?.permissions.forEach((permission) => permissions.add(permission));
  }
  return permissions;
}
