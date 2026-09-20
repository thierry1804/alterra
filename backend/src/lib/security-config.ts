import { readFileSync } from "node:fs";
import { logger } from "./logger.js";

const GUARDED_KEYS = [
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "MFA_ENCRYPTION_KEY",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
] as const;

function exampleValues(): Record<string, string> {
  for (const rel of ["../../../.env.example", "../../.env.example"]) {
    let raw: string;
    try {
      raw = readFileSync(new URL(rel, import.meta.url), "utf8");
    } catch {
      continue;
    }
    return Object.fromEntries(
      raw
        .split("\n")
        .map((line) => line.match(/^([A-Z0-9_]+)=("?)(.*)\2\s*$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [m[1], m[3]]),
    );
  }
  return {};
}

/** Refuse (en production) ou signale bruyamment les secrets identiques au .env.example public. */
export function assertSecureConfig() {
  const examples = exampleValues();
  const weak = GUARDED_KEYS.filter((key) => {
    const value = process.env[key] ?? "";
    return value.length === 0 || value === examples[key] || (key.startsWith("JWT") && value.length < 32);
  });
  if (weak.length === 0) return;

  const message = `Secrets par défaut ou trop faibles : ${weak.join(", ")} — n'importe qui peut forger un jeton ADMIN`;
  if (process.env.NODE_ENV === "production") {
    logger.fatal(message);
    process.exit(1);
  }
  logger.error(message);
}
