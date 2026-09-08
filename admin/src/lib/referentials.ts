export interface Site {
  id: string;
  name: string;
  shortCode: string;
  location: string | null;
  geoLat: number | null;
  geoLng: number | null;
  active: boolean;
}

export interface Activity {
  id: string;
  label: string;
  unit: string;
  unitRate: string;
  validFrom: string;
  validTo: string | null;
  siteId: string | null;
  active: boolean;
}

export interface Worker {
  id: string;
  matricule: string;
  legacyMocId: number | null;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  cinNumber: string | null;
  siteId: string;
  teamId: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  hiredAt: string;
  photoKey: string | null;
}

export interface AppUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: "ADMIN" | "CHEF_SERVICE" | "CHEF_EQUIPE";
  firstName: string;
  lastName: string;
  active: boolean;
  siteId: string | null;
  teamId: string | null;
  lastLoginAt: string | null;
}

export interface ImportPreview {
  valid: Array<{
    row: number;
    matricule: string;
    firstName: string;
    lastName: string;
    existingWorkerId?: string;
  }>;
  errors: Array<{ row: number; field: string; message: string }>;
}

export interface ImportColumnField {
  key: string;
  label: string;
  required: boolean;
}

export interface ImportDetectedColumn {
  column: string;
  label: string;
  samples: string[];
}

export interface ImportColumnsResult {
  columns: ImportDetectedColumn[];
  fields: ImportColumnField[];
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

export function formatRate(value: string | number): string {
  return `${Number(value).toLocaleString("fr-MG")} Ar`;
}

export const WORKER_STATUS_LABELS: Record<Worker["status"], string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  SUSPENDED: "Suspendu",
};

export const USER_ROLE_LABELS: Record<AppUser["role"], string> = {
  ADMIN: "Administrateur",
  CHEF_SERVICE: "Chef de service",
  CHEF_EQUIPE: "Chef d'équipe",
};
