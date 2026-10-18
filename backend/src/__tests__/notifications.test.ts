import { NotificationType, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";

const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_NOTIF_ID = "00000000-0000-4000-8000-000000000091";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    pushSubscription: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("../realtime/socket.js", () => ({
  emitToUser: vi.fn(),
  getIo: vi.fn(() => null),
}));

vi.mock("../services/notifications/web-push.service.js", () => ({
  getVapidPublicKey: vi.fn(() => "test-vapid-public-key"),
  sendWebPushToUser: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import { emitToUser } from "../realtime/socket.js";
import { createAndDispatch } from "../services/notifications/notification.service.js";

function cdsToken() {
  return signAccessToken({
    sub: MOCK_CDS_ID,
    role: Role.CHEF_SERVICE,
    siteId: MOCK_SITE_ID,
    teamId: null,
  });
}

describe("notification.service createAndDispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
  });

  it("persists, audits and emits socket event", async () => {
    const createdAt = new Date("2026-10-18T10:00:00.000Z");
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: MOCK_NOTIF_ID,
      userId: MOCK_CDS_ID,
      type: NotificationType.CLARIFICATION_ANSWERED,
      title: "Réponse du chef d'équipe",
      body: "Photo OK",
      entityType: "ClarificationRequest",
      entityId: "clar-1",
      payload: { href: "/clarifications" },
      readAt: null,
      createdAt,
    } as never);

    const dto = await createAndDispatch({
      userId: MOCK_CDS_ID,
      type: NotificationType.CLARIFICATION_ANSWERED,
      title: "Réponse du chef d'équipe",
      body: "Photo OK",
      entityType: "ClarificationRequest",
      entityId: "clar-1",
      payload: { href: "/clarifications" },
      actorUserId: "cde-1",
    });

    expect(dto.id).toBe(MOCK_NOTIF_ID);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "NOTIFY",
        entityType: "Notification",
        entityId: MOCK_NOTIF_ID,
      }),
    );
    expect(emitToUser).toHaveBeenCalledWith(
      MOCK_CDS_ID,
      "notification",
      expect.objectContaining({ id: MOCK_NOTIF_ID, type: NotificationType.CLARIFICATION_ANSWERED }),
    );
  });
});

describe("notifications routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
  });

  it("GET /notifications returns page for CDS", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      {
        id: MOCK_NOTIF_ID,
        userId: MOCK_CDS_ID,
        type: NotificationType.CLARIFICATION_ANSWERED,
        title: "Réponse",
        body: "OK",
        entityType: "ClarificationRequest",
        entityId: "clar-1",
        payload: null,
        readAt: null,
        createdAt: new Date(),
      },
    ] as never);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${cdsToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(MOCK_NOTIF_ID);
  });

  it("GET /notifications/unread-count returns count", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(3);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${cdsToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it("PATCH /notifications/:id/read marks read and audits", async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({
      id: MOCK_NOTIF_ID,
      userId: MOCK_CDS_ID,
      type: NotificationType.CLARIFICATION_ANSWERED,
      title: "Réponse",
      body: "OK",
      entityType: "ClarificationRequest",
      entityId: "clar-1",
      payload: null,
      readAt: null,
      createdAt: new Date(),
    } as never);
    vi.mocked(prisma.notification.update).mockResolvedValue({
      id: MOCK_NOTIF_ID,
      userId: MOCK_CDS_ID,
      type: NotificationType.CLARIFICATION_ANSWERED,
      title: "Réponse",
      body: "OK",
      entityType: "ClarificationRequest",
      entityId: "clar-1",
      payload: null,
      readAt: new Date(),
      createdAt: new Date(),
    } as never);

    const app = createApp();
    const res = await request(app)
      .patch(`/api/v1/notifications/${MOCK_NOTIF_ID}/read`)
      .set("Authorization", `Bearer ${cdsToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.readAt).toBeTruthy();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "NOTIFY_READ", entityId: MOCK_NOTIF_ID }),
    );
  });
});
