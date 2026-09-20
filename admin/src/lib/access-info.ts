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

/**
 * Comptes de démonstration : injectés uniquement par VITE_DEMO_ACCOUNTS (JSON) sur le poste local.
 * Jamais en dur dans le code — le serveur de dev est exposé sur Internet et sert ces sources.
 */
function loadDemoAccounts(): DemoAccount[] {
  if (!import.meta.env.DEV) return [];
  try {
    const parsed: unknown = JSON.parse(import.meta.env.VITE_DEMO_ACCOUNTS ?? "[]");
    return Array.isArray(parsed) ? (parsed as DemoAccount[]) : [];
  } catch {
    return [];
  }
}

export const DEMO_ACCOUNTS: DemoAccount[] = loadDemoAccounts();
