import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createOnce } from "../services/workflows/idempotency.js";

const row = { id: "1", requestedById: "u1" };

describe("createOnce", () => {
  it("crée normalement sans clientUuid", async () => {
    const create = vi.fn().mockResolvedValue(row);
    const find = vi.fn();
    expect(await createOnce(undefined, "u1", find, create)).toBe(row);
    expect(find).not.toHaveBeenCalled();
  });

  it("renvoie la ligne existante sans recréer", async () => {
    const create = vi.fn();
    expect(await createOnce("c1", "u1", async () => row, create)).toBe(row);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuse un clientUuid appartenant à un autre utilisateur", async () => {
    await expect(createOnce("c1", "u2", async () => row, vi.fn())).rejects.toMatchObject({
      status: 409,
    });
  });

  it("récupère la ligne gagnante en cas de course (P2002)", async () => {
    const find = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    const create = vi
      .fn()
      .mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "5" }),
      );
    expect(await createOnce("c1", "u1", find, create)).toBe(row);
  });
});
