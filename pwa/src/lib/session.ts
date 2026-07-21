import {
  decryptString,
  deriveKeyFromPin,
  encryptString,
  fromBase64,
  generateSalt,
  hashPin,
  toBase64,
  type EncryptedPayload,
} from "./crypto";
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

const SETTING_PIN_SALT = "pinSalt";
const SETTING_PIN_VERIFIER = "pinVerifier";
const SETTING_SESSION = "sessionEncrypted";
const SETTING_LAST_ACTIVITY = "lastActivityAt";

let memorySessionKey: CryptoKey | null = null;
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

export async function hasPinConfigured(): Promise<boolean> {
  const verifier = await getSetting(SETTING_PIN_VERIFIER);
  return !!verifier;
}

export async function hasPersistedSession(): Promise<boolean> {
  const encrypted = await getSetting(SETTING_SESSION);
  return !!encrypted;
}

export async function configurePinAndPersistSession(
  pin: string,
  accessToken: string,
  user: AuthUser,
): Promise<void> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN_INVALID");
  }

  const salt = generateSalt();
  const key = await deriveKeyFromPin(pin, salt);
  const payload: StoredSessionPayload = { accessToken, user };
  const encrypted = await encryptString(JSON.stringify(payload), key);
  const verifier = await hashPin(pin, salt);

  await setSetting(SETTING_PIN_SALT, toBase64(salt));
  await setSetting(SETTING_PIN_VERIFIER, verifier);
  await setSetting(SETTING_SESSION, JSON.stringify(encrypted));
  await touchActivity();

  memorySessionKey = key;
  memoryAccessToken = accessToken;
  memoryUser = user;
}

export async function unlockSessionWithPin(pin: string): Promise<StoredSessionPayload> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN_INVALID");
  }

  const saltB64 = await getSetting(SETTING_PIN_SALT);
  const verifier = await getSetting(SETTING_PIN_VERIFIER);
  const encryptedRaw = await getSetting(SETTING_SESSION);

  if (!saltB64 || !verifier || !encryptedRaw) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const salt = fromBase64(saltB64);
  const pinHash = await hashPin(pin, salt);
  if (pinHash !== verifier) {
    throw new Error("PIN_INCORRECT");
  }

  const key = await deriveKeyFromPin(pin, salt);
  const encrypted = JSON.parse(encryptedRaw) as EncryptedPayload;
  const plaintext = await decryptString(encrypted, key);
  const payload = JSON.parse(plaintext) as StoredSessionPayload;

  memorySessionKey = key;
  memoryAccessToken = payload.accessToken;
  memoryUser = payload.user;
  await touchActivity();

  return payload;
}

export async function persistSessionWithMemoryKey(
  accessToken: string,
  user: AuthUser,
): Promise<void> {
  if (!memorySessionKey) {
    throw new Error("NOT_UNLOCKED");
  }

  const payload: StoredSessionPayload = { accessToken, user };
  const encrypted = await encryptString(JSON.stringify(payload), memorySessionKey);
  await setSetting(SETTING_SESSION, JSON.stringify(encrypted));
  memoryAccessToken = accessToken;
  memoryUser = user;
  await touchActivity();
}

export async function updatePersistedAccessToken(accessToken: string): Promise<void> {
  if (!memoryUser) return;
  await persistSessionWithMemoryKey(accessToken, memoryUser);
}

export async function touchActivity(): Promise<void> {
  await setSetting(SETTING_LAST_ACTIVITY, new Date().toISOString());
}

export async function getLastActivityAt(): Promise<Date | null> {
  const value = await getSetting(SETTING_LAST_ACTIVITY);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getMemorySessionKey(): CryptoKey | null {
  return memorySessionKey;
}

export function lockSession(): void {
  memorySessionKey = null;
  memoryAccessToken = null;
  memoryUser = null;
}

export async function clearPersistedSession(): Promise<void> {
  lockSession();
  await deleteSetting(SETTING_PIN_SALT);
  await deleteSetting(SETTING_PIN_VERIFIER);
  await deleteSetting(SETTING_SESSION);
  await deleteSetting(SETTING_LAST_ACTIVITY);
}

export const INACTIVITY_LOCK_MS = 30 * 60 * 1000;

export async function shouldLockForInactivity(now = Date.now()): Promise<boolean> {
  if (!(await hasPinConfigured())) return false;
  const lastActivity = await getLastActivityAt();
  if (!lastActivity) return isSessionUnlocked();
  return now - lastActivity.getTime() >= INACTIVITY_LOCK_MS;
}
