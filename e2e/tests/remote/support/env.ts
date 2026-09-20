import { fileURLToPath } from "node:url";
import path from "node:path";

export const ADMIN_URL = process.env.ALTERRA_ADMIN_URL ?? "https://alterra-admin.boss-etech.net";
export const PWA_URL = process.env.ALTERRA_PWA_URL ?? "https://alterra-pwa.boss-etech.net";

/** Préfixe obligatoire de toute donnée créée par la recette. */
export const E2E_PREFIX = "E2E-S3-";

/** Dossier de travail local (ignoré par git) : état du jeu de test, registre, fichiers téléchargés. */
export const TMP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.remote-tmp",
);

export type RealRole = "admin" | "cds_amb" | "cds_anj" | "cde_amb2";

/** Comptes réels de démonstration. Les mots de passe ne viennent que de process.env. */
const REAL_ACCOUNTS: Record<RealRole, { email: string; passwordVar: string }> = {
  admin: { email: "admin@alterra.mg", passwordVar: "ALTERRA_ADMIN_PASSWORD" },
  cds_amb: { email: "cds.amb@alterra.test", passwordVar: "ALTERRA_USERS_PASSWORD" },
  cds_anj: { email: "cds.anj@alterra.test", passwordVar: "ALTERRA_USERS_PASSWORD" },
  cde_amb2: { email: "cde.amb2@alterra.test", passwordVar: "ALTERRA_USERS_PASSWORD" },
};

export const INACTIVE_ACCOUNT_EMAIL = "auditeur.sprint2@alterra.test";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement ${name} absente — arrêt de la recette.`);
  }
  return value;
}

export function realCredentials(role: RealRole): { email: string; password: string } {
  const account = REAL_ACCOUNTS[role];
  return { email: account.email, password: requireEnv(account.passwordVar) };
}

export function usersPassword(): string {
  return requireEnv("ALTERRA_USERS_PASSWORD");
}
