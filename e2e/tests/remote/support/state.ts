import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { E2E_PREFIX, TMP_DIR } from "./env.js";

export interface E2EUser {
  id: string;
  email: string;
  password: string;
}

export interface E2EWorker {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
}

export interface World {
  runId: string;
  site: { id: string; code: string; name: string };
  category: { id: string; code: string };
  unitId: string;
  subActivity: { id: string; groupKey: string; label: string; shortLabel: string; rate: number };
  cds: E2EUser;
  cde: E2EUser;
  team: { id: string; name: string };
  workers: E2EWorker[];
  /** Semaine de paie vierge (aucun paiement, toutes années) réservée aux écritures du bordereau. */
  pay: null | {
    year: number;
    weekNumber: number;
    periodIso: string; // ex. 2090-W51
    shortPeriod: string; // ex. S51
    monday: string; // YYYY-MM-DD (lundi ISO de la semaine)
  };
}

export type RegistryKind =
  | "site"
  | "category"
  | "subActivity"
  | "worker"
  | "user"
  | "team"
  | "pointage"
  | "payment";

export interface RegistryEntry {
  kind: RegistryKind;
  id: string;
  label: string;
  at: string;
}

function file(name: string): string {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  return path.join(TMP_DIR, name);
}

export function saveWorld(world: World): void {
  fs.writeFileSync(file("world.json"), JSON.stringify(world, null, 2));
}

export function loadWorld(): World {
  const p = file("world.json");
  if (!fs.existsSync(p)) throw new Error("world.json absent : le projet setup n'a pas tourné.");
  return JSON.parse(fs.readFileSync(p, "utf8")) as World;
}

export function worldExists(): boolean {
  return fs.existsSync(file("world.json"));
}

export function loadRegistry(): RegistryEntry[] {
  const p = file("registry.json");
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as RegistryEntry[]) : [];
}

/** Enregistre immédiatement toute entité créée (le nettoyage s'appuie dessus, puis balaie par préfixe). */
export function track(kind: RegistryKind, id: string | undefined, label = ""): void {
  if (!id) return;
  const entries = loadRegistry();
  if (entries.some((e) => e.kind === kind && e.id === id)) return;
  entries.push({ kind, id, label, at: new Date().toISOString() });
  fs.writeFileSync(file("registry.json"), JSON.stringify(entries, null, 2));
}

/**
 * État partagé entre tests d'un même fichier, persisté sur disque : Playwright redémarre le processus worker
 * après un test en échec, ce qui perdrait des variables de module.
 */
export function stLoad<T extends object>(name: string): T {
  const p = file(`st-${name}.json`);
  return (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {}) as T;
}
export function stSave(name: string, value: object): void {
  fs.writeFileSync(file(`st-${name}.json`), JSON.stringify(value));
}
export function stReset(name: string): void {
  fs.rmSync(file(`st-${name}.json`), { force: true });
}
/** Objet dont chaque lecture/écriture de propriété passe par le fichier d'état (survit aux redémarrages de worker). */
export function persisted<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get: (_t, prop) => (stLoad<any>(name) as any)[prop],
    set: (_t, prop, value) => {
      const current = stLoad<any>(name);
      current[prop] = value;
      stSave(name, current);
      return true;
    },
  });
}

/** Chemin d'un fichier de travail dans .remote-tmp (dossier ignoré par git). */
export function TMP_DIR_FILE(name: string): string {
  return file(name);
}

export function writeTmp(name: string, content: string | Buffer): string {
  const p = file(name);
  fs.writeFileSync(p, content);
  return p;
}

export function readJsonTmp<T>(name: string): T | undefined {
  const p = file(name);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as T) : undefined;
}

/* ------------------------------------------------------------------ */
/* Aléatoire et dates                                                  */
/* ------------------------------------------------------------------ */

export function newRunId(): string {
  return `${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`.toUpperCase();
}

export function randomLetters(n: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: n }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}

export function randomDigits(n: number): string {
  return Array.from({ length: n }, () => String(crypto.randomInt(10))).join("");
}

/** Mot de passe aléatoire pour comptes E2E (jamais journalisé). */
export function randomPassword(): string {
  const core = crypto.randomBytes(15).toString("base64url");
  return `Aa1!${core}`;
}

export function e2eName(runId: string, suffix: string): string {
  return `${E2E_PREFIX}${suffix}-${runId}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine ISO (même algorithme que le backend : semaine 1 = celle du 4 janvier). */
export function isoWeekMonday(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday1 = new Date(jan4);
  monday1.setUTCDate(jan4.getUTCDate() - dow + 1);
  monday1.setUTCDate(monday1.getUTCDate() + (week - 1) * 7);
  return monday1.toISOString().slice(0, 10);
}

export function newUuid(): string {
  return crypto.randomUUID();
}

export function sha1(buf: Buffer | string): string {
  return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
}
