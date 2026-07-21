import { ClarificationStatus, Prisma, RequestStatus, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";

const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000040";
const MOCK_POINTAGE_ID = "00000000-0000-4000-8000-000000000070";
const MOCK_ACTIVITY_REQ_ID = "00000000-0000-4000-8000-000000000080";
const MOCK_CLAR_ID = "00000000-0000-4000-8000-000000000081";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    activityRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workerRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    clarificationRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    activity: {
      create: vi.fn(),
    },
    worker: {
      count: vi.fn(),
      create: vi.fn(),
    },
    site: {
      findUniqueOrThrow: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    pointage: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";

function cdsToken() {
  return signAccessToken({
    sub: MOCK_CDS_ID,
    role: Role.CHEF_SERVICE,
    siteId: MOCK_SITE_ID,
    teamId: null,
  });
}

function adminToken() {
  return signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: null,
    teamId: null,
  });
}

function cdeToken() {
  return signAccessToken({
    sub: MOCK_CDE_ID,
    role: Role.CHEF_EQUIPE,
    siteId: MOCK_SITE_ID,
    teamId: MOCK_TEAM_ID,
  });
}

describe("workflows routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      typeof fn === "function" ? fn(prisma as never) : fn,
    );
  });

  it("POST /activity-requests creates pending request", async () => {
    vi.mocked(prisma.activityRequest.create).mockResolvedValue({
      id: MOCK_ACTIVITY_REQ_ID,
      status: RequestStatus.PENDING,
      proposedLabel: "Plantation bambou",
    } as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/activity-requests")
      .set("Authorization", `Bearer ${cdsToken()}`)
      .send({
        proposedLabel: "Plantation bambou",
        proposedUnit: "plant",
        proposedRate: 120,
        justification: "Nouvelle activité saisonnière sur le versant nord",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");
  });

  it("PATCH /activity-requests/:id/decision approves and creates activity", async () => {
    vi.mocked(prisma.activityRequest.findUnique).mockResolvedValue({
      id: MOCK_ACTIVITY_REQ_ID,
      status: RequestStatus.PENDING,
      proposedLabel: "Plantation bambou",
      proposedUnit: "plant",
      proposedRate: new Prisma.Decimal("120"),
      siteId: MOCK_SITE_ID,
    } as never);
    vi.mocked(prisma.activityRequest.findFirst).mockResolvedValue({
      id: MOCK_ACTIVITY_REQ_ID,
      status: RequestStatus.PENDING,
    } as never);
    vi.mocked(prisma.activity.create).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000090",
    } as never);
    vi.mocked(prisma.activityRequest.update).mockResolvedValue({
      id: MOCK_ACTIVITY_REQ_ID,
      status: RequestStatus.APPROVED,
      createdActivityId: "00000000-0000-4000-8000-000000000090",
    } as never);

    const app = createApp();
    const res = await request(app)
      .patch(`/api/v1/activity-requests/${MOCK_ACTIVITY_REQ_ID}/decision`)
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ decision: "APPROVED" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(prisma.activity.create).toHaveBeenCalled();
  });

  it("POST /clarification-requests sets pointage NEEDS_CLARIFICATION", async () => {
    vi.mocked(prisma.pointage.findUnique).mockResolvedValue({
      id: MOCK_POINTAGE_ID,
      workerId: "worker-1",
      worker: { siteId: MOCK_SITE_ID, teamId: MOCK_TEAM_ID },
    } as never);
    vi.mocked(prisma.clarificationRequest.create).mockResolvedValue({
      id: MOCK_CLAR_ID,
      status: ClarificationStatus.OPEN,
    } as never);
    vi.mocked(prisma.pointage.update).mockResolvedValue({ id: MOCK_POINTAGE_ID } as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/clarification-requests")
      .set("Authorization", `Bearer ${cdsToken()}`)
      .send({
        pointageId: MOCK_POINTAGE_ID,
        question: "Merci de préciser la parcelle exacte pour ce pointage",
        requestedPhoto: true,
      });

    expect(res.status).toBe(201);
    expect(prisma.pointage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "NEEDS_CLARIFICATION" },
      }),
    );
  });

  it("PATCH /clarification-requests/:id/answer moves to ANSWERED", async () => {
    vi.mocked(prisma.clarificationRequest.findUnique).mockResolvedValue({
      id: MOCK_CLAR_ID,
      status: ClarificationStatus.OPEN,
      requestedPhoto: false,
      pointage: { worker: { teamId: MOCK_TEAM_ID, siteId: MOCK_SITE_ID } },
    } as never);
    vi.mocked(prisma.clarificationRequest.findFirst).mockResolvedValue({
      id: MOCK_CLAR_ID,
      status: ClarificationStatus.OPEN,
    } as never);
    vi.mocked(prisma.clarificationRequest.update).mockResolvedValue({
      id: MOCK_CLAR_ID,
      status: ClarificationStatus.ANSWERED,
    } as never);

    const app = createApp();
    const res = await request(app)
      .patch(`/api/v1/clarification-requests/${MOCK_CLAR_ID}/answer`)
      .set("Authorization", `Bearer ${cdeToken()}`)
      .send({ answerText: "Parcelle P-12, photo jointe demain matin" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ANSWERED");
  });

  it("PATCH /activity-requests/:id/complement keeps request pending with comment", async () => {
    vi.mocked(prisma.activityRequest.findUnique).mockResolvedValue({
      id: MOCK_ACTIVITY_REQ_ID,
      status: RequestStatus.PENDING,
    } as never);
    vi.mocked(prisma.activityRequest.findFirst).mockResolvedValue({
      id: MOCK_ACTIVITY_REQ_ID,
      status: RequestStatus.PENDING,
    } as never);
    vi.mocked(prisma.activityRequest.update).mockResolvedValue({
      id: MOCK_ACTIVITY_REQ_ID,
      status: RequestStatus.PENDING,
      decisionReason: "Préciser la parcelle concernée",
    } as never);

    const app = createApp();
    const res = await request(app)
      .patch(`/api/v1/activity-requests/${MOCK_ACTIVITY_REQ_ID}/complement`)
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ comment: "Préciser la parcelle concernée" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PENDING");
    expect(res.body.decisionReason).toBe("Préciser la parcelle concernée");
  });
});
