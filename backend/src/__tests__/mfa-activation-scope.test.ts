import { generateSync } from "otplib";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Le client filtré (RLS) refuse toute écriture sans portée dans le contexte, comme pendant l'activation
// par jeton d'enrôlement (aucune session) ; seul le client de base peut écrire le secret.
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: {
      update: vi.fn(async () => {
        throw new Error("Row-level scope violation");
      }),
    },
  },
  basePrisma: { user: { update: vi.fn(async () => ({})) } },
}));

import { basePrisma, prisma } from "../lib/prisma.js";
import { activateMfa, setupMfa } from "../services/auth/mfa.service.js";

describe("activation MFA sans session", () => {
  beforeEach(() => vi.clearAllMocks());

  it("écrit le secret avec le client de base, pas avec le client filtré par portée", async () => {
    const { otpauthUrl } = await setupMfa("u1", "admin@alterra.mg");
    const secret = new URL(otpauthUrl).searchParams.get("secret")!;

    await expect(activateMfa("u1", generateSync({ secret }))).resolves.toBeUndefined();

    expect(basePrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: { mfaSecret: expect.any(String) } }),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("tolérance du code TOTP", () => {
  beforeEach(() => vi.clearAllMocks());

  async function activateWith(offsetSeconds: number) {
    const { secret } = await setupMfa("u2", "probe@example.com");
    const code = generateSync({ secret, epoch: Math.floor(Date.now() / 1000) + offsetSeconds });
    return activateMfa("u2", code);
  }

  it("accepte le code du pas précédent ou suivant (saisie lente, horloge légèrement décalée)", async () => {
    await expect(activateWith(-30)).resolves.toBeUndefined();
    await expect(activateWith(30)).resolves.toBeUndefined();
  });

  it("refuse un code vieux de plus d'un pas", async () => {
    await expect(activateWith(-90)).rejects.toMatchObject({ code: "INVALID_MFA_CODE" });
    await expect(activateWith(90)).rejects.toMatchObject({ code: "INVALID_MFA_CODE" });
  });
});
