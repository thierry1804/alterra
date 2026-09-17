/** Comptes attendus après seed — utilisé par seed.ts et les tests d'intégration. */
export const EXPECTED_SEED_COUNTS = {
  admin: 1,
  cds: 5,
  cde: 15,
  sites: 5,
  activityCategories: 5,
  units: 6,
  subActivities: 19,
  workers: 50,
  teams: 15,
} as const;

export const ADMIN_ID = "00000000-0000-0000-0002-000000000001";
export const ADMIN_PASSWORD = "ChangeMe123!";
export const USER_PASSWORD = "test123!";

export const SITES = [
  {
    id: "00000000-0000-0000-0001-000000000001",
    name: "Manankazo",
    shortCode: "MNK",
    location: "Antananarivo",
  },
  {
    id: "00000000-0000-0000-0001-000000000002",
    name: "Antsampanana",
    shortCode: "ANT",
    location: "Toamasina",
  },
  {
    id: "00000000-0000-0000-0001-000000000003",
    name: "Anjozorobe",
    shortCode: "ANJ",
    location: "Anjozorobe",
  },
  {
    id: "00000000-0000-0000-0001-000000000004",
    name: "Mangatsa",
    shortCode: "MGT",
    location: "Majunga",
  },
  {
    id: "00000000-0000-0000-0001-000000000005",
    name: "Ambondromamy",
    shortCode: "AMB",
    location: "Ambondromamy",
  },
] as const;

/** Catégories officielles — cf. CATEGORIES DES ACTIVITES MOC PAR SITE.xlsx (identiques sur tous les sites). */
export const ACTIVITY_CATEGORIES = [
  { id: "00000000-0000-0000-0006-000000000001", code: "ACT01", label: "Productions de plants" },
  { id: "00000000-0000-0000-0006-000000000002", code: "ACT02", label: "Préparation du sol" },
  { id: "00000000-0000-0000-0006-000000000003", code: "ACT03", label: "Plantation" },
  { id: "00000000-0000-0000-0006-000000000004", code: "ACT04", label: "Entretien des plantations" },
  { id: "00000000-0000-0000-0006-000000000005", code: "ACT07", label: "Lutte Anti-Feu" },
] as const;

const CAT01 = ACTIVITY_CATEGORIES[0].id;
const CAT02 = ACTIVITY_CATEGORIES[1].id;
const CAT03 = ACTIVITY_CATEGORIES[2].id;
const CAT04 = ACTIVITY_CATEGORIES[3].id;
const CAT07 = ACTIVITY_CATEGORIES[4].id;

/** Référentiel des unités — mêmes IDs que la migration 20260917074448_activity_unit_referential. */
export const UNITS = [
  { id: "00000000-0000-0000-0009-000000000001", code: "PIECE", label: "Pièce" },
  { id: "00000000-0000-0000-0009-000000000002", code: "TROU", label: "Trou" },
  { id: "00000000-0000-0000-0009-000000000003", code: "HA", label: "Ha" },
  { id: "00000000-0000-0000-0009-000000000004", code: "KM", label: "Km" },
  { id: "00000000-0000-0000-0009-000000000005", code: "JOUR", label: "Jour" },
  { id: "00000000-0000-0000-0009-000000000006", code: "PIED", label: "Pied" },
] as const;

const UNIT_PIECE = UNITS[0].id;
const UNIT_TROU = UNITS[1].id;
const UNIT_HA = UNITS[2].id;
const UNIT_KM = UNITS[3].id;
const UNIT_JOUR = UNITS[4].id;
const UNIT_PIED = UNITS[5].id;

/** Sous-activités officielles — mêmes libellés/unités/tarifs que le fichier client sur les 5 sites. */
export const SUB_ACTIVITIES = [
  // ACT01 — Productions de plants
  {
    id: "00000000-0000-0000-0008-000000000001",
    categoryId: CAT01,
    label: "Rebouchage pots 10x12 et 12x15",
    shortLabel: "rebouchage",
    unitId: UNIT_PIECE,
    unitRate: 30,
  },
  {
    id: "00000000-0000-0000-0008-000000000002",
    categoryId: CAT01,
    label: "Rebouchage pots 15x20",
    shortLabel: "rebouchage",
    unitId: UNIT_PIECE,
    unitRate: 40,
  },
  {
    id: "00000000-0000-0000-0008-000000000003",
    categoryId: CAT01,
    label: "Repiquage",
    shortLabel: "repiquage",
    unitId: UNIT_PIECE,
    unitRate: 17,
  },
  // ACT02 — Préparation du sol
  {
    id: "00000000-0000-0000-0008-000000000004",
    categoryId: CAT02,
    label: "Trouaison 40cm x 40cm",
    shortLabel: "trouaison",
    unitId: UNIT_TROU,
    unitRate: 400,
  },
  {
    id: "00000000-0000-0000-0008-000000000005",
    categoryId: CAT02,
    label: "Trouaison 50cm x 50cm",
    shortLabel: "trouaison",
    unitId: UNIT_TROU,
    unitRate: 500,
  },
  {
    id: "00000000-0000-0000-0008-000000000006",
    categoryId: CAT02,
    label: "Trouaison 1m x 60cm",
    shortLabel: "trouaison",
    unitId: UNIT_TROU,
    unitRate: 3000,
  },
  {
    id: "00000000-0000-0000-0008-000000000007",
    categoryId: CAT02,
    label: "Trouaison 1m x 1m",
    shortLabel: "trouaison",
    unitId: UNIT_TROU,
    unitRate: 4000,
  },
  {
    id: "00000000-0000-0000-0008-000000000008",
    categoryId: CAT02,
    label: "Remblayage 40cm x 40cm",
    shortLabel: "remblayage",
    unitId: UNIT_TROU,
    unitRate: 150,
  },
  {
    id: "00000000-0000-0000-0008-000000000009",
    categoryId: CAT02,
    label: "Remblayage 50cm x 50cm",
    shortLabel: "remblayage",
    unitId: UNIT_TROU,
    unitRate: 150,
  },
  {
    id: "00000000-0000-0000-0008-000000000010",
    categoryId: CAT02,
    label: "Remblayage 1m x 60cm",
    shortLabel: "remblayage",
    unitId: UNIT_TROU,
    unitRate: 500,
  },
  {
    id: "00000000-0000-0000-0008-000000000011",
    categoryId: CAT02,
    label: "Remblayage 1m x 1m",
    shortLabel: "remblayage",
    unitId: UNIT_TROU,
    unitRate: 1000,
  },
  {
    id: "00000000-0000-0000-0008-000000000012",
    categoryId: CAT02,
    label: "Labour (par ha)",
    shortLabel: "labour",
    unitId: UNIT_HA,
    unitRate: 350000,
  },
  // ACT03 — Plantation
  {
    id: "00000000-0000-0000-0008-000000000013",
    categoryId: CAT03,
    label: "Transport jeune plant",
    shortLabel: "transport",
    unitId: UNIT_PIED,
    unitRate: 35,
  },
  {
    id: "00000000-0000-0000-0008-000000000014",
    categoryId: CAT03,
    label: "Apport de fumier",
    shortLabel: "fumier",
    unitId: UNIT_PIED,
    unitRate: 20,
  },
  {
    id: "00000000-0000-0000-0008-000000000015",
    categoryId: CAT03,
    label: "Mise en terre",
    shortLabel: "plantation",
    unitId: UNIT_PIED,
    unitRate: 50,
  },
  // ACT04 — Entretien des plantations
  {
    id: "00000000-0000-0000-0008-000000000016",
    categoryId: CAT04,
    label: "Apport de fumure d'entretien (par Hj)",
    shortLabel: "entretien",
    unitId: UNIT_JOUR,
    unitRate: 10000,
  },
  // ACT07 — Lutte Anti-Feu
  {
    id: "00000000-0000-0000-0008-000000000017",
    categoryId: CAT07,
    label: "Détourage des plants",
    shortLabel: "detourage",
    unitId: UNIT_PIED,
    unitRate: 600,
  },
  {
    id: "00000000-0000-0000-0008-000000000018",
    categoryId: CAT07,
    label: "Fauchage des herbes (par ha)",
    shortLabel: "fauchage",
    unitId: UNIT_HA,
    unitRate: 200000,
  },
  {
    id: "00000000-0000-0000-0008-000000000019",
    categoryId: CAT07,
    label: "Ouverture de pare-feux (par km)",
    shortLabel: "parefeux",
    unitId: UNIT_KM,
    unitRate: 160000,
  },
] as const;

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}

export function cdsId(siteIndex: number): string {
  return `00000000-0000-0000-0003-${pad(siteIndex)}000000001`;
}

export function cdeId(siteIndex: number, teamIndex: number): string {
  const n = (siteIndex - 1) * 3 + teamIndex;
  return `00000000-0000-0000-0004-${pad(n)}000000001`;
}

export function teamId(siteIndex: number, teamIndex: number): string {
  const n = (siteIndex - 1) * 3 + teamIndex;
  return `00000000-0000-0000-0005-${pad(n)}000000001`;
}

export function workerId(n: number): string {
  return `00000000-0000-0000-0007-${pad(n)}000000001`;
}
