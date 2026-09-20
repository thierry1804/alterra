import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { logger } from "../lib/logger.js";
import { RlsScopeError } from "./prisma-rls.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `No route for ${req.method} ${req.path}`,
    traceId: req.id,
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.status >= 500 ? undefined : err.details,
      traceId: req.id,
    });
  }

  // Erreurs Prisma prévisibles : elles décrivent un problème de requête, pas une panne du serveur.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
      return res.status(409).json({
        code: "DUPLICATE",
        message: fields.length
          ? `Cette valeur existe déjà (${fields.join(", ")})`
          : "Cette valeur existe déjà",
        details: { fields },
        traceId: req.id,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ code: "NOT_FOUND", message: "Ressource introuvable", traceId: req.id });
    }
  }

  if (err instanceof RlsScopeError) {
    return res
      .status(403)
      .json({ code: "FORBIDDEN", message: "Hors de votre périmètre", traceId: req.id });
  }

  logger.error({ err, traceId: req.id, path: req.path }, "Unhandled error");
  res
    .status(500)
    .json({ code: "INTERNAL_ERROR", message: "Unexpected server error", traceId: req.id });
}
