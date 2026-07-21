/** Comptes attendus après seed — utilisé par seed.ts et les tests d'intégration. */
export const EXPECTED_SEED_COUNTS = {
  admin: 1,
  cds: 5,
  cde: 15,
  sites: 5,
  activities: 10,
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

export const ACTIVITIES = [
  { id: "00000000-0000-0000-0006-000000000001", label: "Trouaison", unit: "trou", unitRate: 150 },
  { id: "00000000-0000-0000-0006-000000000002", label: "Plantation", unit: "plant", unitRate: 200 },
  { id: "00000000-0000-0000-0006-000000000003", label: "Désherbage", unit: "m²", unitRate: 80 },
  { id: "00000000-0000-0000-0006-000000000004", label: "Taille", unit: "plant", unitRate: 120 },
  { id: "00000000-0000-0000-0006-000000000005", label: "Récolte", unit: "kg", unitRate: 350 },
  { id: "00000000-0000-0000-0006-000000000006", label: "Transport", unit: "kg", unitRate: 100 },
  { id: "00000000-0000-0000-0006-000000000007", label: "Arrosage", unit: "m²", unitRate: 60 },
  { id: "00000000-0000-0000-0006-000000000008", label: "Paillage", unit: "m²", unitRate: 90 },
  { id: "00000000-0000-0000-0006-000000000009", label: "Protection", unit: "plant", unitRate: 180 },
  { id: "00000000-0000-0000-0006-000000000010", label: "Entretien clôture", unit: "m", unitRate: 250 },
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
