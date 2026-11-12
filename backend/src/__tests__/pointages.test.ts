import { Prisma, Role, PointageStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000020";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000040";
const MOCK_ACTIVITY_ID = "00000000-0000-4000-8000-000000000050";
const MOCK_POINTAGE_ID = "00000000-0000-4000-8000-000000000060";
const MOCK_CLIENT_UUID = "00000000-0000-4000-8000-000000000070";

const mockActivity = {
  id: MOCK_ACTIVITY_ID,
  label: "Plantation",
  unit: "plant",
  unitRate: new Prisma.Decimal("150.00"),
  validFrom: new Date("2026-01-01"),
  validTo: null,
  siteId: MOCK_SITE_ID,
  active: true,
  createdAt: new Date(),
};

const mockPointage = {
  id: MOCK_POINTAGE_ID,
  clientUuid: MOCK_CLIENT_UUID,
  workerId: MOCK_WORKER_ID,
  subActivityId: MOCK_ACTIVITY_ID,
  quantity: new Prisma.Decimal("10"),
  unitRateSnapshot: new Prisma.Decimal("150.00"),
  amount: new Prisma.Decimal("1500.00"),
  date: new Date("2026-07-15"),
  parcelleId: null,
  geoLat: null,
  geoLng: null,
  photoKey: null,
  notes: null,
  status: PointageStatus.PENDING,
  enteredById: MOCK_CDE_ID,
  validatedById: null,
  validatedAt: null,
  rejectionReason: null,
  bioCheckId: null,
  createdByClientAt: new Date("2026-07-15T08:00:00Z"),
  syncedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    activitySubActivity: {
      findUniqueOrThrow: vi.fn(),
    },
    pointage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    worker: {
      findUnique: vi.fn(),
    },
    biometricCheck: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    appSetting: {
      findUnique: vi.fn(),
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

vi.mock("../services/notifications/notify-helpers.js", () => ({
  notifyPointagesRejected: vi.fn(),
  notifyPointagesValidated: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";

function adminAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: MOCK_SITE_ID,
    teamId: null,
  })}`;
}

function cdsAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_CDS_ID,
    role: Role.CHEF_SERVICE,
    siteId: MOCK_SITE_ID,
    teamId: null,
  })}`;
}

function cdeAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_CDE_ID,
    role: Role.CHEF_EQUIPE,
    siteId: MOCK_SITE_ID,
    teamId: MOCK_TEAM_ID,
  })}`;
}

describe("Pointages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.activitySubActivity.findUniqueOrThrow).mockResolvedValue(
      mockActivity as never,
    );
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
    vi.mocked(prisma.worker.findUnique).mockResolvedValue({
      teamId: MOCK_TEAM_ID,
      siteId: MOCK_SITE_ID,
    } as never);
    vi.mocked(prisma.pointage.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      typeof fn === "function" ? fn(prisma as never) : fn,
    );
  });

  describe("POST /pointages/sync", () => {
    const syncPayload = {
      batch: [
        {
          clientUuid: MOCK_CLIENT_UUID,
          workerId: MOCK_WORKER_ID,
          subActivityId: MOCK_ACTIVITY_ID,
          quantity: 10,
          date: "2026-07-15",
          createdByClientAt: "2026-07-15T08:00:00Z",
        },
      ],
    };

    it("rejects a pointage dated more than 3 days before the entry day", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/v1/pointages/sync")
        .set("Authorization", cdeAuthHeader())
        .send({ batch: [{ ...syncPayload.batch[0], date: "2026-07-10" }] });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe("rejected");
      expect(res.body.results[0].reason).toMatch(/3 jours/);
      expect(prisma.pointage.create).not.toHaveBeenCalled();
    });

    it("rejects a pointage dated in the future", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/v1/pointages/sync")
        .set("Authorization", cdeAuthHeader())
        .send({ batch: [{ ...syncPayload.batch[0], date: "2026-07-20" }] });

      expect(res.body.results[0].status).toBe("rejected");
      expect(res.body.results[0].reason).toMatch(/futur/);
    });

    it("rejects a second activity for the same worker on the same day", async () => {
      vi.mocked(prisma.pointage.findFirst).mockResolvedValue({
        id: "other",
        subActivityId: "11111111-1111-4111-8111-111111111111",
        subActivity: { label: "Fauchage" },
      } as never);

      const res = await request(createApp())
        .post("/api/v1/pointages/sync")
        .set("Authorization", cdeAuthHeader())
        .send(syncPayload);

      expect(res.status).toBe(200);
      expect(res.body.results[0]).toMatchObject({ status: "rejected" });
      expect(res.body.results[0].reason).toContain("une seule activité par jour");
      expect(prisma.pointage.create).not.toHaveBeenCalled();
    });

    it("rejects a worker who belongs to another team than the chef d'équipe", async () => {
      vi.mocked(prisma.worker.findUnique).mockResolvedValue({
        teamId: "22222222-2222-4222-8222-222222222222",
        siteId: MOCK_SITE_ID,
      } as never);

      const res = await request(createApp())
        .post("/api/v1/pointages/sync")
        .set("Authorization", cdeAuthHeader())
        .send(syncPayload);

      expect(res.body.results[0]).toMatchObject({
        status: "rejected",
        reason: "Ce travailleur n'appartient pas à votre équipe",
      });
      expect(prisma.pointage.create).not.toHaveBeenCalled();
    });

    it("returns already_exists on duplicate clientUuid", async () => {
      vi.mocked(prisma.pointage.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "5.20.0",
          meta: { modelName: "Pointage", target: ["clientUuid"] },
        }),
      );
      vi.mocked(prisma.pointage.findUnique).mockResolvedValue(mockPointage as never);

      const app = createApp();
      const res = await request(app)
        .post("/api/v1/pointages/sync")
        .set("Authorization", cdeAuthHeader())
        .send(syncPayload);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([
        {
          clientUuid: MOCK_CLIENT_UUID,
          status: "already_exists",
          id: MOCK_POINTAGE_ID,
        },
      ]);
    });

    it("rejects a concurrent sync caught by the active-slot DB constraint (not clientUuid)", async () => {
      vi.mocked(prisma.pointage.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "5.20.0",
          meta: { modelName: "Pointage", target: ["workerId", "subActivityId", "date"] },
        }),
      );

      const app = createApp();
      const res = await request(app)
        .post("/api/v1/pointages/sync")
        .set("Authorization", cdeAuthHeader())
        .send(syncPayload);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([
        {
          clientUuid: MOCK_CLIENT_UUID,
          status: "rejected",
          reason: expect.stringContaining("déjà pointé ce jour-là"),
        },
      ]);
      expect(prisma.pointage.findUnique).not.toHaveBeenCalled();
    });

    it("classifies a transient DB error (P2024, pool saturé) as retry, not a permanent rejection", async () => {
      vi.mocked(prisma.pointage.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          "Timed out fetching a new connection from the pool",
          { code: "P2024", clientVersion: "5.20.0" },
        ),
      );

      const app = createApp();
      const res = await request(app)
        .post("/api/v1/pointages/sync")
        .set("Authorization", cdeAuthHeader())
        .send(syncPayload);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([
        {
          clientUuid: MOCK_CLIENT_UUID,
          status: "retry",
          reason: "Timed out fetching a new connection from the pool",
        },
      ]);
    });

    it("keeps a genuine business error as a permanent rejection, not a retry", async () => {
      vi.mocked(prisma.pointage.create).mockRejectedValue(new Error("Validation métier échouée"));

      const app = createApp();
      const res = await request(app)
        .post("/api/v1/pointages/sync")
        .set("Authorization", cdeAuthHeader())
        .send(syncPayload);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([
        {
          clientUuid: MOCK_CLIENT_UUID,
          status: "rejected",
          reason: "Validation métier échouée",
        },
      ]);
    });
  });

  describe("PATCH /pointages/:id/validate", () => {
    it("blocks validation when latest bio is not OK", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue(mockPointage as never);
      vi.mocked(prisma.biometricCheck.findFirst).mockResolvedValue({
        id: "bio-ko",
        workerId: MOCK_WORKER_ID,
        result: "KO",
        context: "WEEKLY_VALIDATION",
        performedAt: new Date("2026-07-16T10:00:00Z"),
        weekIso: "2026-W29",
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/validate`)
        .set("Authorization", cdsAuthHeader());

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("BIO_NOT_OK");
      expect(prisma.biometricCheck.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workerId: MOCK_WORKER_ID, weekIso: "2026-W29" },
          orderBy: { performedAt: "desc" },
        }),
      );
    });

    it("blocks validation when no bio check exists", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue(mockPointage as never);
      vi.mocked(prisma.biometricCheck.findFirst).mockResolvedValue(null);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/validate`)
        .set("Authorization", cdsAuthHeader());

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("BIO_NOT_OK");
    });

    it("succeeds when latest bio is OK", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow)
        .mockResolvedValueOnce(mockPointage as never)
        .mockResolvedValueOnce({
          ...mockPointage,
          status: PointageStatus.VALIDATED,
          validatedById: MOCK_CDS_ID,
          validatedAt: new Date(),
        } as never);
      vi.mocked(prisma.biometricCheck.findFirst).mockResolvedValue({
        id: "bio-1",
        workerId: MOCK_WORKER_ID,
        result: "OK",
        context: "WEEKLY_VALIDATION",
        performedAt: new Date("2026-07-14T10:00:00Z"),
        weekIso: "2026-W29",
      } as never);
      vi.mocked(prisma.pointage.updateMany).mockResolvedValue({ count: 1 });

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/validate`)
        .set("Authorization", cdsAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("VALIDATED");
      expect(prisma.pointage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_POINTAGE_ID, status: PointageStatus.PENDING },
          data: expect.objectContaining({
            status: "VALIDATED",
            validatedById: MOCK_CDS_ID,
          }),
        }),
      );
    });

    it("fails with INVALID_STATUS when a concurrent action already changed the status", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValueOnce(mockPointage as never);
      vi.mocked(prisma.biometricCheck.findFirst).mockResolvedValue({
        id: "bio-1",
        workerId: MOCK_WORKER_ID,
        result: "OK",
        context: "WEEKLY_VALIDATION",
        performedAt: new Date("2026-07-14T10:00:00Z"),
        weekIso: "2026-W29",
      } as never);
      // Un rejet concurrent a deja fait bouger le statut entre la lecture et l'ecriture.
      vi.mocked(prisma.pointage.updateMany).mockResolvedValue({ count: 0 });

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/validate`)
        .set("Authorization", cdsAuthHeader());

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATUS");
    });
  });

  describe("PATCH /pointages/:id/reject", () => {
    it("requires rejectionReason", async () => {
      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/reject`)
        .set("Authorization", cdsAuthHeader())
        .send({ rejectionReason: "no" });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects with a valid reason", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow)
        .mockResolvedValueOnce(mockPointage as never)
        .mockResolvedValueOnce({
          ...mockPointage,
          status: PointageStatus.REJECTED,
          rejectionReason: "Quantité suspecte sur le terrain",
          validatedById: MOCK_CDS_ID,
        } as never);
      vi.mocked(prisma.pointage.updateMany).mockResolvedValue({ count: 1 });

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/reject`)
        .set("Authorization", cdsAuthHeader())
        .send({ rejectionReason: "Quantité suspecte sur le terrain" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("REJECTED");
      expect(prisma.pointage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_POINTAGE_ID, status: PointageStatus.PENDING },
          data: expect.objectContaining({ status: "REJECTED" }),
        }),
      );
    });

    it("fails with INVALID_STATUS when a concurrent validation already changed the status", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValueOnce(mockPointage as never);
      // Une validation concurrente a deja fait bouger le statut entre la lecture et l'ecriture.
      vi.mocked(prisma.pointage.updateMany).mockResolvedValue({ count: 0 });

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/reject`)
        .set("Authorization", cdsAuthHeader())
        .send({ rejectionReason: "Quantité suspecte sur le terrain" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATUS");
    });
  });

  describe("PATCH /pointages/:id (admin correction)", () => {
    it("requires correctionReason", async () => {
      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}`)
        .set("Authorization", adminAuthHeader())
        .send({ quantity: 12, correctionReason: "too short" });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("applies correction with audit log when reason is valid", async () => {
      const correctionReason = "Erreur de saisie terrain corrigée";
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue(mockPointage as never);
      vi.mocked(prisma.pointage.update).mockResolvedValue({
        ...mockPointage,
        quantity: new Prisma.Decimal("12"),
        amount: new Prisma.Decimal("1800.00"),
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}`)
        .set("Authorization", adminAuthHeader())
        .send({ quantity: 12, correctionReason });

      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(basePrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "CORRECT",
            entityType: "Pointage",
            entityId: MOCK_POINTAGE_ID,
            before: expect.objectContaining({ correctionReason }),
            after: expect.objectContaining({ correctionReason }),
          }),
        }),
      );
    });

    it("returns DUPLICATE_SLOT when the correction collides with the active-slot constraint", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue(mockPointage as never);
      vi.mocked(prisma.pointage.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "5.20.0",
          meta: { modelName: "Pointage", target: ["workerId", "subActivityId", "date"] },
        }),
      );

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}`)
        .set("Authorization", adminAuthHeader())
        .send({ date: "2026-07-16", correctionReason: "Date corrigée après vérification terrain" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("DUPLICATE_SLOT");
    });
  });

  describe("PATCH /pointages/:id/resubmit", () => {
    const rejectedPointage = {
      ...mockPointage,
      status: PointageStatus.REJECTED,
      rejectionReason: "Quantité suspecte",
      enteredById: MOCK_CDE_ID,
    };

    it("requires resubmitReason", async () => {
      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/resubmit`)
        .set("Authorization", cdeAuthHeader())
        .send({ resubmitReason: "no" });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects with DUPLICATE_SLOT when another active pointage already fills the slot", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue(rejectedPointage as never);
      vi.mocked(prisma.pointage.findFirst).mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000099",
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/resubmit`)
        .set("Authorization", cdeAuthHeader())
        .send({ resubmitReason: "Quantité vérifiée et confirmée" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("DUPLICATE_SLOT");
      expect(prisma.pointage.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workerId: rejectedPointage.workerId,
            date: rejectedPointage.date,
            status: { not: "REJECTED" },
            id: { not: MOCK_POINTAGE_ID },
          }),
        }),
      );
      expect(prisma.pointage.update).not.toHaveBeenCalled();
    });

    it("resubmits successfully when no other active pointage occupies the slot", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue(rejectedPointage as never);
      vi.mocked(prisma.pointage.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.pointage.update).mockResolvedValue({
        ...rejectedPointage,
        status: PointageStatus.PENDING,
        rejectionReason: null,
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/resubmit`)
        .set("Authorization", cdeAuthHeader())
        .send({ resubmitReason: "Quantité vérifiée et confirmée" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("PENDING");
    });
  });

  describe("PATCH /pointages/:id/photo", () => {
    it("rejects a photoKey outside the pointages/<uuid>.jpg shape (IDOR guard)", async () => {
      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/photo`)
        .set("Authorization", cdeAuthHeader())
        .send({ photoKey: `workers/${MOCK_WORKER_ID}/11111111-1111-1111-1111-111111111111.jpg` });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(prisma.pointage.update).not.toHaveBeenCalled();
    });

    it("attaches the photo when the pointage has none yet", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue(mockPointage as never);
      vi.mocked(prisma.pointage.update).mockResolvedValue({
        ...mockPointage,
        photoKey: "pointages/11111111-1111-1111-1111-111111111111.jpg",
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/photo`)
        .set("Authorization", cdeAuthHeader())
        .send({ photoKey: "pointages/11111111-1111-1111-1111-111111111111.jpg" });

      expect(res.status).toBe(200);
      expect(res.body.photoKey).toBe("pointages/11111111-1111-1111-1111-111111111111.jpg");
      expect(prisma.pointage.update).toHaveBeenCalledWith({
        where: { id: MOCK_POINTAGE_ID },
        data: { photoKey: "pointages/11111111-1111-1111-1111-111111111111.jpg" },
      });
    });

    it("rejects another CHEF_EQUIPE's entry (FORBIDDEN)", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue({
        ...mockPointage,
        enteredById: "00000000-0000-4000-8000-000000000099",
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/photo`)
        .set("Authorization", cdeAuthHeader())
        .send({ photoKey: "pointages/11111111-1111-1111-1111-111111111111.jpg" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
      expect(prisma.pointage.update).not.toHaveBeenCalled();
    });

    it("rejects once the pointage is VALIDATED (INVALID_STATUS)", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue({
        ...mockPointage,
        status: PointageStatus.VALIDATED,
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/photo`)
        .set("Authorization", cdeAuthHeader())
        .send({ photoKey: "pointages/11111111-1111-1111-1111-111111111111.jpg" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATUS");
      expect(prisma.pointage.update).not.toHaveBeenCalled();
    });

    it("is idempotent when retried with the same photoKey (network retry)", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue({
        ...mockPointage,
        photoKey: "pointages/11111111-1111-1111-1111-111111111111.jpg",
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/photo`)
        .set("Authorization", cdeAuthHeader())
        .send({ photoKey: "pointages/11111111-1111-1111-1111-111111111111.jpg" });

      expect(res.status).toBe(200);
      expect(prisma.pointage.update).not.toHaveBeenCalled();
    });

    it("rejects overwriting a different existing photo (PHOTO_ALREADY_SET)", async () => {
      vi.mocked(prisma.pointage.findUniqueOrThrow).mockResolvedValue({
        ...mockPointage,
        photoKey: "pointages/22222222-2222-2222-2222-222222222222.jpg",
      } as never);

      const app = createApp();
      const res = await request(app)
        .patch(`/api/v1/pointages/${MOCK_POINTAGE_ID}/photo`)
        .set("Authorization", cdeAuthHeader())
        .send({ photoKey: "pointages/11111111-1111-1111-1111-111111111111.jpg" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PHOTO_ALREADY_SET");
      expect(prisma.pointage.update).not.toHaveBeenCalled();
    });
  });
});
