import { ApiError } from "../middleware/error-handler.js";
import { getRedis } from "./redis.js";

const MAX_FAILURES = 10;
const WINDOW_SECONDS = 15 * 60;

const key = (email: string) => `login:fail:${email.trim().toLowerCase()}`;

/** Verrouillage par adresse e-mail (existante ou non — pas d'énumération) : 10 échecs / 15 min. */
export async function assertLoginNotLocked(email: string): Promise<void> {
  const redis = await getRedis();
  const failures = Number((await redis.get(key(email))) ?? 0);
  if (failures >= MAX_FAILURES) {
    throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Trop de tentatives — réessayez dans quelques minutes");
  }
}

export async function recordLoginFailure(email: string): Promise<void> {
  const redis = await getRedis();
  const failures = Number((await redis.get(key(email))) ?? 0) + 1;
  await redis.setEx(key(email), WINDOW_SECONDS, String(failures));
}

export async function clearLoginFailures(email: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(key(email));
}
