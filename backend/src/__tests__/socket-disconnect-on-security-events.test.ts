import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "00000000-0000-4000-8000-000000000050";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { update: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000050" }) },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    user: { update: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000050" }) },
    passwordReset: {
      findUnique: vi.fn().mockResolvedValue({
        id: "reset-1",
        userId: "00000000-0000-4000-8000-000000000050",
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../lib/redis.js", () => ({
  blockUser: vi.fn(),
  invalidateTokensIssuedBefore: vi.fn(),
}));

vi.mock("../middleware/prisma-rls.js", () => ({
  getRequestContext: vi.fn(() => undefined),
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("../realtime/socket.js", () => ({
  disconnectUserSockets: vi.fn(),
}));

import { disconnectUserSockets } from "../realtime/socket.js";
import { deactivateUser, resetUserPassword } from "../services/users/user-admin.service.js";
import { confirmPasswordReset } from "../services/auth/password-reset.service.js";

describe("security events disconnect already-open sockets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deactivateUser disconnects the user's open sockets", async () => {
    await deactivateUser(USER_ID);
    expect(disconnectUserSockets).toHaveBeenCalledWith(USER_ID);
  });

  it("resetUserPassword (admin) disconnects the user's open sockets", async () => {
    await resetUserPassword(USER_ID, "hashed");
    expect(disconnectUserSockets).toHaveBeenCalledWith(USER_ID);
  });

  it("confirmPasswordReset (self-service) disconnects the user's open sockets", async () => {
    await confirmPasswordReset("raw-token", "NewPassword123!");
    expect(disconnectUserSockets).toHaveBeenCalledWith(USER_ID);
  });
});
