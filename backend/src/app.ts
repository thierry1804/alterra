import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger.js";
import { apiRouter } from "./routes/index.js";
import { healthRouter } from "./routes/health.routes.js";
import { auditSensitiveRoutes } from "./middleware/audit.interceptor.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/prisma-rls.js";

const ORIGINS = [process.env.ADMIN_ORIGIN, process.env.PWA_ORIGIN]
  .filter(Boolean)
  .flatMap((origin) => origin!.split(",").map((value) => value.trim()))
  .filter(Boolean) as string[];

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: ORIGINS, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(requestContext);
  app.use(pinoHttp({ logger }));

  // Strict on auth: anti-bruteforce (relaxed in dev/CI for E2E and local testing).
  app.use(
    "/api/v1/auth",
    rateLimit({
      windowMs: 5 * 60 * 1000,
      limit: process.env.NODE_ENV === "production" ? 10 : 1000,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  // Generous on sync: never penalize a large resync after a long field outage.
  app.use(
    "/api/v1/pointages/sync",
    rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }),
  );
  // Default: generic per-user/IP ceiling.
  app.use(
    "/api/v1",
    rateLimit({ windowMs: 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false }),
  );

  app.use(healthRouter);
  app.use("/api/v1", auditSensitiveRoutes, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
