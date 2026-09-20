import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { areTokensRevoked, getRedis, invalidateTokensIssuedBefore } from "../lib/redis.js";

const userId = randomUUID();

afterAll(async () => {
  const redis = await getRedis();
  await redis.del(`user:tokens-valid-after:${userId}`);
});

describe("invalidation des jetons après réinitialisation du mot de passe (A5)", () => {
  it("n'affecte pas un utilisateur sans réinitialisation", async () => {
    expect(await areTokensRevoked(randomUUID(), 1)).toBe(false);
  });

  it("refuse les jetons émis avant la réinitialisation, accepte ceux émis après", async () => {
    const resetAt = Date.now();
    await invalidateTokensIssuedBefore(userId, resetAt);
    const resetSec = Math.floor(resetAt / 1000);

    expect(await areTokensRevoked(userId, resetSec - 60)).toBe(true);
    expect(await areTokensRevoked(userId, resetSec)).toBe(false);
    expect(await areTokensRevoked(userId, resetSec + 5)).toBe(false);
  });

  it("refuse un jeton sans date d'émission une fois le compte réinitialisé", async () => {
    expect(await areTokensRevoked(userId, undefined)).toBe(true);
  });
});
