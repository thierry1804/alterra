export interface PermissionAction {
  action: string;
  label: string;
}

export interface PermissionResource {
  resource: string;
  label: string;
  actions: readonly PermissionAction[];
}

export const PERMISSION_CATALOG = [
  {
    resource: "pointage",
    label: "Pointages",
    actions: [
      { action: "lecture", label: "Voir les pointages et leurs photos" },
      { action: "saisie", label: "Saisir et synchroniser des pointages" },
      { action: "correction", label: "Corriger un pointage" },
      { action: "valider_site", label: "Valider ou rejeter (validation site)" },
      { action: "valider_technique", label: "Validation technique globale" },
      { action: "synthese", label: "Synthèses par activité et par semaine" },
      { action: "voir_montants", label: "Voir les montants des pointages" },
    ],
  },
  {
    resource: "presence",
    label: "Présence NFC",
    actions: [
      { action: "lecture", label: "Consulter la présence" },
      { action: "saisie", label: "Synchroniser la présence" },
    ],
  },
  {
    resource: "biometrie",
    label: "Biométrie",
    actions: [
      { action: "verifier_en_ligne", label: "Contrôle biométrique en ligne" },
      { action: "verifier_hors_ligne", label: "Contrôle biométrique hors ligne" },
      { action: "gabarits_lecture", label: "Télécharger les gabarits" },
      { action: "gabarits_ecriture", label: "Enrôler et modifier les gabarits" },
    ],
  },
  {
    resource: "travailleur",
    label: "Travailleurs",
    actions: [
      { action: "lecture", label: "Voir les travailleurs" },
      { action: "ecriture", label: "Créer et modifier" },
      { action: "suppression", label: "Supprimer" },
      { action: "import", label: "Importer depuis un fichier" },
    ],
  },
  {
    resource: "equipe",
    label: "Équipes",
    actions: [
      { action: "lecture", label: "Voir les équipes" },
      { action: "membres", label: "Gérer les membres d'une équipe" },
      { action: "ecriture", label: "Créer, modifier et supprimer une équipe" },
    ],
  },
  {
    resource: "site",
    label: "Sites",
    actions: [
      { action: "lecture", label: "Voir les sites" },
      { action: "ecriture", label: "Créer et modifier" },
      { action: "suppression", label: "Supprimer" },
    ],
  },
  {
    resource: "zone",
    label: "Zones",
    actions: [
      { action: "lecture", label: "Voir les zones" },
      { action: "ecriture", label: "Créer et modifier" },
      { action: "suppression", label: "Supprimer" },
    ],
  },
  {
    resource: "parcelle",
    label: "Parcelles",
    actions: [
      { action: "lecture", label: "Voir les parcelles" },
      { action: "ecriture", label: "Créer et modifier" },
      { action: "suppression", label: "Supprimer" },
    ],
  },
  {
    resource: "carte",
    label: "Carte",
    actions: [{ action: "lecture", label: "Afficher la carte des sites" }],
  },
  {
    resource: "activite",
    label: "Activités et unités",
    actions: [
      { action: "lecture", label: "Voir activités, tarifs et unités" },
      { action: "ecriture", label: "Créer et modifier" },
      { action: "suppression", label: "Supprimer" },
    ],
  },
  {
    resource: "badge",
    label: "Badges NFC",
    actions: [
      { action: "lecture", label: "Voir les badges" },
      { action: "ecriture", label: "Créer, modifier et supprimer" },
    ],
  },
  {
    resource: "demande",
    label: "Demandes",
    actions: [
      { action: "lecture", label: "Voir les demandes" },
      { action: "creer", label: "Créer une demande" },
      { action: "annuler", label: "Annuler une demande" },
      { action: "decider", label: "Accepter ou refuser" },
    ],
  },
  {
    resource: "precision",
    label: "Demandes de précision",
    actions: [
      { action: "lecture", label: "Voir les précisions" },
      { action: "creer", label: "Demander une précision" },
      { action: "repondre", label: "Répondre à une précision" },
      { action: "cloturer", label: "Clôturer une précision" },
    ],
  },
  {
    resource: "paiement",
    label: "Paiements",
    actions: [
      { action: "lecture", label: "Voir les paiements" },
      { action: "generation", label: "Générer les paiements" },
      { action: "correction", label: "Corriger un paiement" },
      { action: "suppression", label: "Supprimer les paiements d'une période" },
      { action: "import_statut", label: "Importer le retour MVola" },
      { action: "export", label: "Exporter vers MVola" },
    ],
  },
  {
    resource: "bordereau",
    label: "Bordereaux",
    actions: [
      { action: "lecture", label: "Voir les bordereaux" },
      { action: "generation", label: "Générer et régénérer un bordereau" },
      { action: "valider_finance", label: "Première validation (finance)" },
      { action: "valider_dg", label: "Deuxième validation (DG)" },
    ],
  },
  {
    resource: "facture",
    label: "Factures",
    actions: [
      { action: "lecture", label: "Voir et télécharger" },
      { action: "generation", label: "Générer et régénérer" },
    ],
  },
  {
    resource: "tableau_bord",
    label: "Tableau de bord",
    actions: [{ action: "lecture", label: "Afficher le tableau de bord" }],
  },
  {
    resource: "rapport",
    label: "Rapports",
    actions: [
      { action: "generation", label: "Rapports hebdomadaires et journaliers" },
      { action: "analyse", label: "Rapports d'analyse et exports" },
    ],
  },
  {
    resource: "utilisateur",
    label: "Utilisateurs",
    actions: [
      { action: "lecture", label: "Voir les utilisateurs" },
      { action: "ecriture", label: "Créer, modifier et désactiver" },
      { action: "affecter_role", label: "Attribuer un rôle" },
    ],
  },
  {
    resource: "role",
    label: "Rôles et groupes",
    actions: [{ action: "gerer", label: "Créer et modifier les rôles et groupes" }],
  },
  {
    resource: "audit",
    label: "Journal d'audit",
    actions: [{ action: "lecture", label: "Consulter le journal" }],
  },
  {
    resource: "parametres",
    label: "Paramètres",
    actions: [{ action: "ecriture", label: "Modifier les paramètres de l'application" }],
  },
  {
    resource: "systeme",
    label: "Système",
    actions: [
      { action: "sauvegarde", label: "Télécharger une sauvegarde" },
      { action: "restauration", label: "Restaurer une sauvegarde" },
    ],
  },
] as const satisfies readonly PermissionResource[];

type CatalogEntry = (typeof PERMISSION_CATALOG)[number];

export type PermissionKey = {
  [R in CatalogEntry as R["resource"]]: `${R["resource"]}:${R["actions"][number]["action"]}`;
}[CatalogEntry["resource"]];

const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_CATALOG.flatMap((entry) =>
  entry.actions.map((action) => `${entry.resource}:${action.action}` as PermissionKey),
);

const KNOWN_KEYS: ReadonlySet<string> = new Set(ALL_PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return KNOWN_KEYS.has(value);
}
