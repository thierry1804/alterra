export interface AppAccessLink {
  label: string;
  description: string;
  href: string;
}

export interface DemoAccount {
  role: string;
  email: string;
  password: string;
}

export const ADMIN_APP_ROLES = [
  "Administrateur — référentiels, paiements, audit",
  "Chef de service — validation, clôture, supervision",
];

export const TERRAIN_APP: AppAccessLink = {
  label: "Application terrain",
  description: "Pointage, saisie lot, synchronisation offline",
  href: import.meta.env.VITE_PWA_ORIGIN ?? "http://localhost:5174",
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "Administrateur", email: "admin@alterra.mg", password: "ChangeMe123!" },
  { role: "Chef de service (MNK)", email: "cds.mnk@alterra.test", password: "test123!" },
];
