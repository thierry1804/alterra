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

export const TERRAIN_APP_ROLES = [
  "Chef de service — validation hebdomadaire, clôture journalière",
  "Chef d'équipe — saisie quotidienne, NFC, synchronisation",
];

export const ADMIN_APP: AppAccessLink = {
  label: "Back-office",
  description: "Administration, paiements, cartographie, audit",
  href: import.meta.env.VITE_ADMIN_ORIGIN ?? "http://localhost:5173",
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "Chef de service (MNK)", email: "cds.mnk@alterra.test", password: "test123!" },
  { role: "Chef d'équipe MNK-1", email: "cde.mnk1@alterra.test", password: "test123!" },
];
