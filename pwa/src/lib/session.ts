import { exportKeyToBase64, generateDeviceKey, importKeyFromBase64 } from "./crypto";
import { deleteSetting, getSetting, setSetting } from "../db/db";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "CHEF_SERVICE" | "CHEF_EQUIPE";
  siteId: string | null;
  teamId: string | null;
}

interface StoredSessionPayload {
  accessToken: string;
  user: AuthUser;
}

const SETTING_SESSION = "session";
const SETTING_DEVICE_KEY = "deviceKey";

let memoryDeviceKey: CryptoKey | null = null;
let memoryAccessToken: string | null = null;
let memoryUser: AuthUser | null = null;

export function getMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export function getMemoryUser(): AuthUser | null {
  return memoryUser;
}

export function isSessionUnlocked(): boolean {
  return memoryAccessToken !== null && memoryUser !== null;
}

/** Clé de chiffrement au repos pour les données locales sensibles (templates biométriques) — sans secret utilisateur, générée une fois par appareil. */
export function getDeviceKey(): CryptoKey | null {
  return memoryDeviceKey;
}

async function ensureDeviceKey(): Promise<CryptoKey> {
  if (memoryDeviceKey) return memoryDeviceKey;

  const stored = await getSetting(SETTING_DEVICE_KEY);
  if (stored) {
    memoryDeviceKey = await importKeyFromBase64(stored);
    return memoryDeviceKey;
  }

  const key = await generateDeviceKey();
  await setSetting(SETTING_DEVICE_KEY, await exportKeyToBase64(key));
  memoryDeviceKey = key;
  return key;
}

/** Restaure la session persistée en mémoire au démarrage de l'app (hors-ligne, sans appel réseau). */
export async function restoreSession(): Promise<boolean> {
  await ensureDeviceKey();

  const raw = await getSetting(SETTING_SESSION);
  if (!raw) return false;

  const payload = JSON.parse(raw) as StoredSessionPayload;
  memoryAccessToken = payload.accessToken;
  memoryUser = payload.user;
  return true;
}

export async function persistSession(accessToken: string, user: AuthUser): Promise<void> {
  await ensureDeviceKey();
  const payload: StoredSessionPayload = { accessToken, user };
  await setSetting(SETTING_SESSION, JSON.stringify(payload));
  memoryAccessToken = accessToken;
  memoryUser = user;
}

export async function updatePersistedAccessToken(accessToken: string): Promise<void> {
  if (!memoryUser) return;
  await persistSession(accessToken, memoryUser);
}

export async function clearPersistedSession(): Promise<void> {
  memoryAccessToken = null;
  memoryUser = null;
  await deleteSetting(SETTING_SESSION);
}
