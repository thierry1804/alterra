import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { logger } from "../lib/logger.js";
import { sendPasswordResetEmail } from "../services/notifications/email.service.js";

describe("email.service mock mode (Mailgun not configured)", () => {
  const SECRET_TOKEN = "super-secret-reset-token-abc123";
  const resetUrl = `https://admin.alterra.mg/reset-password?token=${SECRET_TOKEN}`;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
  });

  afterEach(() => {
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
  });

  it("never logs the password reset link or token", async () => {
    await sendPasswordResetEmail("user@alterra.test", resetUrl);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const [payload] = vi.mocked(logger.info).mock.calls[0];
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain(SECRET_TOKEN);
    expect(serialized).not.toContain(resetUrl);
    expect(payload).not.toHaveProperty("text");
  });
});
