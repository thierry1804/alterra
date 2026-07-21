import { Router } from "express";
import { z } from "zod";
import { Prisma, Role, WorkerStatus } from "@prisma/client";
import { prisma, basePrisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import type { Request } from "express";

export const teamsRouter = Router();

const teamIdParams = z.object({ id: z.string().uuid() });
const memberParams = teamIdParams.extend({ workerId: z.string().uuid() });

const listTeamsQuery = z.object({
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const createTeamSchema = z.object({
  name: z.string().min(1).max(80),
  chefId: z.string().uuid().nullable().optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  chefId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const addMemberSchema = z.object({
  workerId: z.string().uuid(),
});

const TEAM_ROLES = [Role.CHEF_SERVICE, Role.CHEF_EQUIPE, Role.ADMIN] as const;
const CDS_ROLES = [Role.CHEF_SERVICE, Role.ADMIN] as const;

const workerMemberSelect = {
  id: true,
  matricule: true,
  firstName: true,
  lastName: true,
  teamId: true,
} satisfies Prisma.WorkerSelect;

const teamDetailInclude = {
  workers: {
    where: { deletedAt: null, status: WorkerStatus.ACTIVE },
    select: workerMemberSelect,
    orderBy: [{ lastName: "asc" as const }, { firstName: "asc" as const }],
  },
} satisfies Prisma.TeamInclude;

type TeamWithWorkers = Prisma.TeamGetPayload<{ include: typeof teamDetailInclude }>;

function assertCanManageTeamStructure(req: Request): void {
  if (req.user!.role === Role.CHEF_EQUIPE) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Le chef d'équipe ne peut pas modifier la structure des équipes",
    );
  }
}

function assertCanManageMembers(req: Request, teamId: string): void {
  if (req.user!.role === Role.CHEF_EQUIPE && req.user!.teamId !== teamId) {
    throw new ApiError(403, "FORBIDDEN", "Accès équipe refusé");
  }
}

async function assertTeamReadable(req: Request, team: { id: string; siteId: string }): Promise<void> {
  if (req.user!.role === Role.CHEF_EQUIPE && req.user!.teamId !== team.id) {
    throw new ApiError(403, "FORBIDDEN", "Accès équipe refusé");
  }
  if (req.user!.role === Role.CHEF_SERVICE && req.user!.siteId !== team.siteId) {
    throw new ApiError(403, "FORBIDDEN", "Accès site refusé");
  }
}

async function serializeTeam(team: TeamWithWorkers) {
  const chef = team.chefId
    ? await prisma.user.findFirst({
        where: { id: team.chefId, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          teamId: true,
        },
      })
    : null;

  return {
    id: team.id,
    siteId: team.siteId,
    name: team.name,
    chefId: team.chefId,
    active: team.active,
    createdAt: team.createdAt,
    chef,
    members: team.workers,
    memberCount: team.workers.length,
  };
}

async function loadTeamOr404(id: string): Promise<TeamWithWorkers> {
  const team = await prisma.team.findFirst({
    where: { id },
    include: teamDetailInclude,
  });
  if (!team) throw new ApiError(404, "NOT_FOUND", "Équipe introuvable");
  return team;
}

async function syncChefAssignment(
  teamId: string,
  siteId: string,
  nextChefId: string | null,
  previousChefId: string | null,
): Promise<void> {
  if (previousChefId && previousChefId !== nextChefId) {
    await basePrisma.user.updateMany({
      where: { id: previousChefId, teamId },
      data: { teamId: null },
    });
  }

  if (nextChefId) {
    const chef = await basePrisma.user.findFirst({
      where: {
        id: nextChefId,
        role: Role.CHEF_EQUIPE,
        siteId,
        deletedAt: null,
        active: true,
      },
    });
    if (!chef) {
      throw new ApiError(422, "INVALID_CHEF", "Chef d'équipe invalide pour ce site");
    }
    await basePrisma.user.update({
      where: { id: nextChefId },
      data: { teamId },
    });
  }
}

teamsRouter.get(
  "/teams/chef-candidates",
  requireAuth,
  requireRole(...CDS_ROLES),
  async (req, res, next) => {
    try {
      const siteId =
        req.user!.role === Role.CHEF_SERVICE ? req.user!.siteId : req.query.siteId;
      if (!siteId) {
        throw new ApiError(422, "SITE_REQUIRED", "Site requis pour lister les chefs");
      }

      const chefs = await prisma.user.findMany({
        where: {
          role: Role.CHEF_EQUIPE,
          siteId: siteId as string,
          deletedAt: null,
          active: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          teamId: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

      res.json({ data: chefs });
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.get(
  "/teams",
  requireAuth,
  requireRole(...TEAM_ROLES),
  validate(listTeamsQuery, "query"),
  async (req, res, next) => {
    try {
      const { active } = req.query as z.infer<typeof listTeamsQuery>;
      const where: Prisma.TeamWhereInput = {};
      if (active !== undefined) where.active = active;

      const teams = await prisma.team.findMany({
        where,
        include: {
          _count: {
            select: {
              workers: { where: { deletedAt: null, status: WorkerStatus.ACTIVE } },
            },
          },
        },
        orderBy: [{ name: "asc" }],
      });

      const data = await Promise.all(
        teams.map(async (team) => {
          const chef = team.chefId
            ? await prisma.user.findFirst({
                where: { id: team.chefId, deletedAt: null },
                select: { id: true, firstName: true, lastName: true, email: true },
              })
            : null;
          return {
            id: team.id,
            siteId: team.siteId,
            name: team.name,
            chefId: team.chefId,
            active: team.active,
            createdAt: team.createdAt,
            chef,
            memberCount: team._count.workers,
          };
        }),
      );

      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.get(
  "/teams/:id",
  requireAuth,
  requireRole(...TEAM_ROLES),
  validate(teamIdParams, "params"),
  async (req, res, next) => {
    try {
      const team = await loadTeamOr404(req.params.id);
      await assertTeamReadable(req, team);
      res.json(await serializeTeam(team));
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.post(
  "/teams",
  requireAuth,
  requireRole(...CDS_ROLES),
  validate(createTeamSchema),
  async (req, res, next) => {
    try {
      assertCanManageTeamStructure(req);
      const siteId = req.user!.siteId;
      if (!siteId) {
        throw new ApiError(422, "SITE_REQUIRED", "Site requis pour créer une équipe");
      }

      const chefId = req.body.chefId ?? null;
      const team = await prisma.team.create({
        data: {
          siteId,
          name: req.body.name.trim(),
          chefId,
        },
        include: teamDetailInclude,
      });

      if (chefId) {
        await syncChefAssignment(team.id, siteId, chefId, null);
      }

      const refreshed = await loadTeamOr404(team.id);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "Team",
        entityId: team.id,
        after: refreshed,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(await serializeTeam(refreshed));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return next(
          new ApiError(409, "DUPLICATE", "Une équipe avec ce nom existe déjà sur le site"),
        );
      }
      next(err);
    }
  },
);

teamsRouter.patch(
  "/teams/:id",
  requireAuth,
  requireRole(...CDS_ROLES),
  validate(teamIdParams, "params"),
  validate(updateTeamSchema),
  async (req, res, next) => {
    try {
      assertCanManageTeamStructure(req);
      const before = await loadTeamOr404(req.params.id);
      await assertTeamReadable(req, before);

      const data: Prisma.TeamUpdateInput = {};
      if (req.body.name !== undefined) data.name = req.body.name.trim();
      if (req.body.active !== undefined) data.active = req.body.active;

      const chefChanging = req.body.chefId !== undefined;
      const nextChefId = chefChanging ? (req.body.chefId as string | null) : before.chefId;

      if (chefChanging) {
        data.chefId = nextChefId;
      }

      const team = await prisma.team.update({
        where: { id: before.id },
        data,
        include: teamDetailInclude,
      });

      if (chefChanging) {
        await syncChefAssignment(before.id, before.siteId, nextChefId, before.chefId);
      }

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Team",
        entityId: team.id,
        before,
        after: team,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(await serializeTeam(await loadTeamOr404(team.id)));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return next(
          new ApiError(409, "DUPLICATE", "Une équipe avec ce nom existe déjà sur le site"),
        );
      }
      next(err);
    }
  },
);

teamsRouter.delete(
  "/teams/:id",
  requireAuth,
  requireRole(...CDS_ROLES),
  validate(teamIdParams, "params"),
  async (req, res, next) => {
    try {
      assertCanManageTeamStructure(req);
      const team = await loadTeamOr404(req.params.id);
      await assertTeamReadable(req, team);

      if (team.workers.length > 0) {
        const deactivated = await prisma.team.update({
          where: { id: team.id },
          data: { active: false },
        });
        await writeAuditLog({
          userId: req.user!.sub,
          action: "UPDATE",
          entityType: "Team",
          entityId: team.id,
          before: team,
          after: deactivated,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
        return res.json({ deactivated: true, team: deactivated });
      }

      if (team.chefId) {
        await basePrisma.user.updateMany({
          where: { id: team.chefId, teamId: team.id },
          data: { teamId: null },
        });
      }

      await prisma.team.delete({ where: { id: team.id } });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DELETE",
        entityType: "Team",
        entityId: team.id,
        before: team,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.post(
  "/teams/:id/members",
  requireAuth,
  requireRole(...TEAM_ROLES),
  validate(teamIdParams, "params"),
  validate(addMemberSchema),
  async (req, res, next) => {
    try {
      const team = await loadTeamOr404(req.params.id);
      assertCanManageMembers(req, team.id);
      await assertTeamReadable(req, team);

      if (!team.active) {
        throw new ApiError(409, "TEAM_INACTIVE", "Équipe inactive");
      }

      const worker = await basePrisma.worker.findFirst({
        where: { id: req.body.workerId, deletedAt: null, status: WorkerStatus.ACTIVE },
      });
      if (!worker || worker.siteId !== team.siteId) {
        throw new ApiError(404, "NOT_FOUND", "MOC introuvable sur ce site");
      }

      if (req.user!.role === Role.CHEF_EQUIPE) {
        if (worker.teamId && worker.teamId !== team.id) {
          throw new ApiError(
            403,
            "FORBIDDEN",
            "Ce MOC appartient déjà à une autre équipe — contactez le chef de service",
          );
        }
      }

      if (worker.teamId === team.id) {
        return res.json(worker);
      }

      const updated = await basePrisma.worker.update({
        where: { id: worker.id },
        data: { teamId: team.id },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Worker",
        entityId: worker.id,
        before: { teamId: worker.teamId },
        after: { teamId: team.id },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(updated);
    } catch (err) {
      next(err);
    }
  },
);

teamsRouter.delete(
  "/teams/:id/members/:workerId",
  requireAuth,
  requireRole(...TEAM_ROLES),
  validate(memberParams, "params"),
  async (req, res, next) => {
    try {
      const team = await loadTeamOr404(req.params.id);
      assertCanManageMembers(req, team.id);
      await assertTeamReadable(req, team);

      const worker = await basePrisma.worker.findFirst({
        where: {
          id: req.params.workerId,
          teamId: team.id,
          deletedAt: null,
        },
      });
      if (!worker) {
        throw new ApiError(404, "NOT_FOUND", "MOC introuvable dans cette équipe");
      }

      const updated = await basePrisma.worker.update({
        where: { id: worker.id },
        data: { teamId: null },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Worker",
        entityId: worker.id,
        before: { teamId: team.id },
        after: { teamId: null },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);
