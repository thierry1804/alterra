import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

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
      details: err.details,
      traceId: req.id,
    });
  }

  logger.error({ err, traceId: req.id, path: req.path }, "Unhandled error");
  res
    .status(500)
    .json({ code: "INTERNAL_ERROR", message: "Unexpected server error", traceId: req.id });
}
