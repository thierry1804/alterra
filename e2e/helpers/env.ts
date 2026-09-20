/** Les mots de passe viennent de la base seedée : fournis par l'environnement, jamais en dur. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} requis — mot de passe défini via SEED_*_PASSWORD (ou affiché une fois par npm run db:seed)`);
  return value;
}

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@alterra.mg";
export const ADMIN_PASSWORD = required("E2E_ADMIN_PASSWORD");
export const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:5173";
export const CDE_EMAIL = process.env.E2E_CDE_EMAIL ?? "cde.mnk1@alterra.test";
export const CDS_EMAIL = process.env.E2E_CDS_EMAIL ?? "cds.mnk@alterra.test";
export const USER_PASSWORD = required("E2E_USER_PASSWORD");
export const PIN = process.env.E2E_PIN ?? "1234";
/** Premier MOC seed (site MNK, équipe 1). */
export const SEED_WORKER_ID = "00000000-0000-0000-0007-001000000001";
