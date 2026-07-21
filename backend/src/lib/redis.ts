import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const USE_IN_MEMORY =
  process.env.NODE_ENV === "test" || process.env.REDIS_IN_MEMORY === "true";

type RedisLike = {
  setEx(key: string, ttlSeconds: number, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
};

class InMemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

let client: RedisLike | null = null;
let initPromise: Promise<RedisLike> | null = null;

async function connectRedis(): Promise<RedisLike> {
  if (USE_IN_MEMORY) {
    logger.info("Redis: in-memory fallback (test or REDIS_IN_MEMORY=true)");
    return new InMemoryRedis();
  }

  const redis = createClient({ url: REDIS_URL }) as RedisClientType;
  redis.on("error", (err) => logger.warn({ err }, "Redis client error"));

  try {
    await redis.connect();
    logger.info("Redis: connected");
    return {
      setEx: (key, ttl, value) => redis.setEx(key, ttl, value),
      get: (key) => redis.get(key),
      del: (key) => redis.del(key).then(() => undefined),
    };
  } catch (err) {
    logger.warn({ err }, "Redis unavailable — using in-memory fallback");
    return new InMemoryRedis();
  }
}

/** Lazy singleton. Falls back to in-memory store in test or when Redis is down. */
export async function getRedis(): Promise<RedisLike> {
  if (client) return client;
  if (!initPromise) initPromise = connectRedis().then((c) => (client = c));
  return initPromise;
}

const BLACKLIST_PREFIX = "refresh:blacklist:";

export async function blacklistRefreshToken(tokenHash: string, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return;
  const redis = await getRedis();
  await redis.setEx(`${BLACKLIST_PREFIX}${tokenHash}`, ttlSeconds, "1");
}

export async function isRefreshTokenBlacklisted(tokenHash: string): Promise<boolean> {
  const redis = await getRedis();
  const value = await redis.get(`${BLACKLIST_PREFIX}${tokenHash}`);
  return value !== null;
}

const MFA_PENDING_PREFIX = "mfa:pending:";
const MFA_PENDING_TTL_SECONDS = 10 * 60;

export async function storePendingMfaSecret(userId: string, encryptedSecret: string): Promise<void> {
  const redis = await getRedis();
  await redis.setEx(`${MFA_PENDING_PREFIX}${userId}`, MFA_PENDING_TTL_SECONDS, encryptedSecret);
}

export async function getPendingMfaSecret(userId: string): Promise<string | null> {
  const redis = await getRedis();
  return redis.get(`${MFA_PENDING_PREFIX}${userId}`);
}

export async function deletePendingMfaSecret(userId: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(`${MFA_PENDING_PREFIX}${userId}`);
}

const USER_BLOCKED_PREFIX = "user:blocked:";
const USER_BLOCKED_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function blockUser(userId: string): Promise<void> {
  const redis = await getRedis();
  await redis.setEx(`${USER_BLOCKED_PREFIX}${userId}`, USER_BLOCKED_TTL_SECONDS, "1");
}

export async function isUserBlocked(userId: string): Promise<boolean> {
  const redis = await getRedis();
  return (await redis.get(`${USER_BLOCKED_PREFIX}${userId}`)) !== null;
}

/** Reset client between tests. */
export async function resetRedisForTests(): Promise<void> {
  client = null;
  initPromise = null;
}
