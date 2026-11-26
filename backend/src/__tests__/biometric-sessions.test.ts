import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { SYSTEM_ROLE_IDS } from "../services/access/system-roles.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    worker: { findUnique: vi.fn() },
    biometricCheck: { create: vi.fn() },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    biometricSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    worker: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";
import {
  MockBridgeLicenseProvider,
  getBridgeLicenseProvider,
} from "../services/biometric/bridge-license.provider.js";
import {
  RESULT_GRACE_MS,
  SESSION_TTL_MS,
  bioResultFor,
  completeSession,
  createSession,
  getSessionView,
  hashReference,
  startSession,
} from "../services/biometric/session.service.js";

const WORKER_ID = "00000000-0000-4000-8000-000000000040";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-0000000000a1";
const REFERENCE = "abcdefghijklmnop1234";
const NOW = new Date("2026-11-26T10:00:00.000Z");

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    referenceHash: hashReference(REFERENCE),
    workerId: WORKER_ID,
    createdById: USER_ID,
    context: "POINTAGE_TASK",
    referenceDate: null,
    status: "PENDING",
    expiresAt: new Date(NOW.getTime() + SESSION_TTL_MS),
    deviceId: null,
    outcome: null,
    ...overrides,
  };
}

const provider = new MockBridgeLicenseProvider();

const future = () => new Date(Date.now() + SESSION_TTL_MS);

describe("biometric session service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
  });

  it("creates a session without keeping the reference in clear", async () => {
    vi.mocked(prisma.worker.findUnique).mockResolvedValue({ id: WORKER_ID } as never);
    vi.mocked(basePrisma.biometricSession.create).mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({ id: SESSION_ID, ...args.data })) as never);

    const created = await createSession({ workerId: WORKER_ID, createdById: USER_ID }, NOW);

    expect(created.reference).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    const data = vi.mocked(basePrisma.biometricSession.create).mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(data.referenceHash).toBe(hashReference(created.reference));
    expect(JSON.stringify(data)).not.toContain(created.reference);
    expect(created.expiresAt).toBe(new Date(NOW.getTime() + SESSION_TTL_MS).toISOString());
  });

  it("refuses a worker out of the caller's scope", async () => {
    vi.mocked(prisma.worker.findUnique).mockResolvedValue(null);

    await expect(
      createSession({ workerId: WORKER_ID, createdById: USER_ID }, NOW),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(basePrisma.biometricSession.create).not.toHaveBeenCalled();
  });

  it("shows a session only to the user who created it", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(session() as never);

    expect((await getSessionView(SESSION_ID, USER_ID, NOW)).status).toBe("PENDING");
    await expect(getSessionView(SESSION_ID, "someone-else", NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("reports an unfinished session as expired once its time is over", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(session() as never);

    const later = new Date(NOW.getTime() + SESSION_TTL_MS + 1000);

    expect((await getSessionView(SESSION_ID, USER_ID, later)).status).toBe("EXPIRED");
  });

  it("starts a session and returns the licence and the reference photo", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(session() as never);
    vi.mocked(basePrisma.worker.findUnique).mockResolvedValue({
      id: WORKER_ID,
      mvolaNumber: "0340000001",
    } as never);
    vi.mocked(basePrisma.biometricSession.update).mockResolvedValue({} as never);

    const ticket = await startSession(
      REFERENCE,
      { deviceId: "DEV-1", engineVersion: "1.0" },
      provider,
      NOW,
    );

    expect(ticket.accessToken.length).toBeGreaterThan(8);
    expect(ticket.referenceFaceBase64.length).toBeGreaterThan(8);
    expect(basePrisma.biometricSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "STARTED", deviceId: "DEV-1" }),
      }),
    );
  });

  it("refuses to start an unknown, expired or finished session", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValueOnce(null);
    await expect(
      startSession(REFERENCE, { deviceId: "D", engineVersion: "" }, provider, NOW),
    ).rejects.toMatchObject({ status: 404 });

    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValueOnce(
      session({ expiresAt: new Date(NOW.getTime() - 1) }) as never,
    );
    await expect(
      startSession(REFERENCE, { deviceId: "D", engineVersion: "" }, provider, NOW),
    ).rejects.toMatchObject({ status: 410 });

    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValueOnce(
      session({ status: "COMPLETED" }) as never,
    );
    await expect(
      startSession(REFERENCE, { deviceId: "D", engineVersion: "" }, provider, NOW),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("stores a MATCH as a successful biometric check", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(
      session({ status: "STARTED", deviceId: "DEV-1" }) as never,
    );
    vi.mocked(prisma.biometricCheck.create).mockResolvedValue({ id: "check-1" } as never);
    vi.mocked(basePrisma.biometricSession.update).mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => session({ status: "COMPLETED", ...args.data })) as never);

    const view = await completeSession(
      REFERENCE,
      { deviceId: "DEV-1", engineVersion: "1.0", outcome: "MATCH", score: 9, liveness: 92 },
      undefined,
      NOW,
    );

    expect(prisma.biometricCheck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ result: "OK", workerId: WORKER_ID, performedById: USER_ID }),
    });
    expect(view.status).toBe("COMPLETED");
    expect(view.bioResult).toBe("OK");
  });

  it("stores a NO_MATCH as a failed check and an unfinished capture as no check at all", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(
      session({ status: "STARTED", deviceId: "DEV-1" }) as never,
    );
    vi.mocked(prisma.biometricCheck.create).mockResolvedValue({ id: "check-2" } as never);
    vi.mocked(basePrisma.biometricSession.update).mockResolvedValue(
      session({ status: "COMPLETED" }) as never,
    );

    await completeSession(
      REFERENCE,
      { deviceId: "DEV-1", engineVersion: "", outcome: "NO_MATCH" },
      undefined,
      NOW,
    );
    expect(prisma.biometricCheck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ result: "KO" }),
    });

    vi.mocked(prisma.biometricCheck.create).mockClear();
    await completeSession(
      REFERENCE,
      { deviceId: "DEV-1", engineVersion: "", outcome: "FACE_NOT_DETECTED" },
      undefined,
      NOW,
    );
    await completeSession(
      REFERENCE,
      { deviceId: "DEV-1", engineVersion: "", outcome: "CANCELLED" },
      undefined,
      NOW,
    );
    expect(prisma.biometricCheck.create).not.toHaveBeenCalled();
  });

  it("refuses a result from another phone or for a session that was never started", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValueOnce(
      session({ status: "STARTED", deviceId: "DEV-1" }) as never,
    );
    await expect(
      completeSession(
        REFERENCE,
        { deviceId: "OTHER", engineVersion: "", outcome: "MATCH" },
        undefined,
        NOW,
      ),
    ).rejects.toMatchObject({ status: 403 });

    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValueOnce(session() as never);
    await expect(
      completeSession(
        REFERENCE,
        { deviceId: "DEV-1", engineVersion: "", outcome: "MATCH" },
        undefined,
        NOW,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.biometricCheck.create).not.toHaveBeenCalled();
  });

  it("accepts a late result inside the grace period and refuses it afterwards", async () => {
    const expiresAt = new Date(NOW.getTime() - 60_000);
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(
      session({ status: "STARTED", deviceId: "DEV-1", expiresAt }) as never,
    );
    vi.mocked(prisma.biometricCheck.create).mockResolvedValue({ id: "c" } as never);
    vi.mocked(basePrisma.biometricSession.update).mockResolvedValue(
      session({ status: "COMPLETED" }) as never,
    );

    await expect(
      completeSession(
        REFERENCE,
        { deviceId: "DEV-1", engineVersion: "", outcome: "MATCH" },
        undefined,
        NOW,
      ),
    ).resolves.toBeDefined();

    const tooLate = new Date(expiresAt.getTime() + RESULT_GRACE_MS + 1000);
    await expect(
      completeSession(
        REFERENCE,
        { deviceId: "DEV-1", engineVersion: "", outcome: "MATCH" },
        undefined,
        tooLate,
      ),
    ).rejects.toMatchObject({ status: 410 });
  });

  it("does not record a second result for a finished session", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(
      session({ status: "COMPLETED", outcome: "MATCH" }) as never,
    );

    const view = await completeSession(
      REFERENCE,
      { deviceId: "DEV-1", engineVersion: "", outcome: "NO_MATCH" },
      undefined,
      NOW,
    );

    expect(view.outcome).toBe("MATCH");
    expect(prisma.biometricCheck.create).not.toHaveBeenCalled();
    expect(basePrisma.biometricSession.update).not.toHaveBeenCalled();
  });

  it("maps every outcome to a verdict only when it is a real verdict", () => {
    expect(bioResultFor("MATCH")).toBe("OK");
    expect(bioResultFor("NO_MATCH")).toBe("KO");
    expect(bioResultFor("LIVENESS_FAILED")).toBe("KO");
    for (const outcome of [
      "FACE_NOT_DETECTED",
      "CANCELLED",
      "UPDATE_REQUIRED",
      "LICENSE_PROBLEM",
      "FAILURE",
    ] as const) {
      expect(bioResultFor(outcome)).toBeNull();
    }
  });
});

describe("bridge license provider selection", () => {
  it("uses the mock outside production", () => {
    expect(
      getBridgeLicenseProvider({ NODE_ENV: "development" } as NodeJS.ProcessEnv),
    ).toBeInstanceOf(MockBridgeLicenseProvider);
  });

  it("refuses the mock in production and any provider that is not implemented", () => {
    expect(() =>
      getBridgeLicenseProvider({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toThrow();
    expect(() =>
      getBridgeLicenseProvider({
        NODE_ENV: "development",
        BIOMETRIC_BRIDGE_PROVIDER: "TELMA",
      } as NodeJS.ProcessEnv),
    ).toThrow();
  });
});

describe("biometric session routes", () => {
  const adminHeader = () =>
    `Bearer ${signAccessToken({ sub: USER_ID, roleId: SYSTEM_ROLE_IDS.ADMIN, siteId: null, teamId: null })}`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
  });

  it("requires a signed-in user to create a session", async () => {
    const res = await request(createApp())
      .post("/api/v1/biometric/sessions")
      .send({ workerId: WORKER_ID });

    expect(res.status).toBe(401);
  });

  it("creates a session and returns its reference once", async () => {
    vi.mocked(prisma.worker.findUnique).mockResolvedValue({ id: WORKER_ID } as never);
    vi.mocked(basePrisma.biometricSession.create).mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({ id: SESSION_ID, ...args.data })) as never);

    const res = await request(createApp())
      .post("/api/v1/biometric/sessions")
      .set("Authorization", adminHeader())
      .send({ workerId: WORKER_ID });

    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(res.body.id).toBe(SESSION_ID);
  });

  it("lets the bridge start and finish a session with the reference alone", async () => {
    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(
      session({ expiresAt: future() }) as never,
    );
    vi.mocked(basePrisma.worker.findUnique).mockResolvedValue({
      id: WORKER_ID,
      mvolaNumber: "0340000001",
    } as never);
    vi.mocked(basePrisma.biometricSession.update).mockResolvedValue({} as never);

    const start = await request(createApp())
      .post(`/api/v1/biometric/sessions/${REFERENCE}/start`)
      .send({ deviceId: "DEV-1", engineVersion: "1.0" });

    expect(start.status).toBe(200);
    expect(start.body.accessToken).toBeTruthy();
    expect(start.body.referenceFace).toBeTruthy();

    vi.mocked(basePrisma.biometricSession.findUnique).mockResolvedValue(
      session({ status: "STARTED", deviceId: "DEV-1", expiresAt: future() }) as never,
    );
    vi.mocked(prisma.biometricCheck.create).mockResolvedValue({ id: "c" } as never);
    vi.mocked(basePrisma.biometricSession.update).mockResolvedValue(
      session({ status: "COMPLETED", outcome: "MATCH" }) as never,
    );

    const result = await request(createApp())
      .post(`/api/v1/biometric/sessions/${REFERENCE}/result`)
      .send({ deviceId: "DEV-1", engineVersion: "1.0", outcome: "MATCH", score: 9 });

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("COMPLETED");
  });

  it("rejects a malformed reference and an unknown outcome", async () => {
    const badReference = await request(createApp())
      .post("/api/v1/biometric/sessions/court/start")
      .send({ deviceId: "DEV-1" });
    expect(badReference.status).toBe(422);

    const badOutcome = await request(createApp())
      .post(`/api/v1/biometric/sessions/${REFERENCE}/result`)
      .send({ deviceId: "DEV-1", outcome: "SUCCESS" });
    expect(badOutcome.status).toBe(422);
    expect(basePrisma.biometricSession.findUnique).not.toHaveBeenCalled();
  });
});
