import { Router } from "express";
import { z } from "zod";
import { spawn } from "node:child_process";
import { createGzip, createGunzip } from "node:zlib";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import { logger } from "../lib/logger.js";
import { BUCKETS, minioClient } from "../services/storage/minio.js";
import { backupUploadUrl } from "../services/storage/presigned-url.service.js";

export const systemRouter = Router();

function pgConnParams() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    dbname: url.pathname.replace(/^\//, ""),
  };
}

function timestampSuffix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const restoreSchema = z.object({
  backupKey: z.string().min(1),
});

function assertBackupKeyPrefix(backupKey: string) {
  if (!backupKey.startsWith("backups/")) {
    throw new ApiError(422, "INVALID_BACKUP_KEY", "Clé de sauvegarde invalide");
  }
}

systemRouter.get("/system/backup", requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  const { host, port, user, password, dbname } = pgConnParams();
  const dump = spawn(
    "pg_dump",
    ["-h", host, "-p", port, "-U", user, "-d", dbname, "--clean", "--if-exists", "--no-owner", "--no-privileges"],
    { env: { ...process.env, PGPASSWORD: password } },
  );

  let stderr = "";
  dump.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  let failed = false;
  dump.on("error", (err) => {
    failed = true;
    logger.error({ err }, "pg_dump spawn failed");
    if (!res.headersSent) next(new ApiError(500, "BACKUP_FAILED", "Échec du démarrage de pg_dump"));
  });

  dump.on("close", (code) => {
    if (code !== 0 && !failed) {
      logger.error({ code, stderr }, "pg_dump exited with error");
      if (!res.headersSent) {
        next(new ApiError(500, "BACKUP_FAILED", "pg_dump a échoué", { code, stderr }));
      } else {
        res.destroy();
      }
    }
  });

  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", `attachment; filename="alterra-backup-${timestampSuffix()}.sql.gz"`);

  dump.stdout.pipe(createGzip()).pipe(res);

  res.on("close", async () => {
    if (res.writableFinished) {
      await writeAuditLog({
        userId: req.user!.sub,
        action: "EXPORT",
        entityType: "Database",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch((err) => logger.error({ err }, "audit log write failed after backup"));
    }
  });
});

systemRouter.post(
  "/system/backup-upload-url",
  requireAuth,
  requireRole(Role.ADMIN),
  async (_req, res, next) => {
    try {
      const result = await backupUploadUrl();
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.post(
  "/system/restore",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(restoreSchema),
  async (req, res, next) => {
    const { backupKey } = req.body as z.infer<typeof restoreSchema>;
    assertBackupKeyPrefix(backupKey);

    try {
      const objectStream = await minioClient.getObject(BUCKETS.assets, backupKey);
      const { host, port, user, password, dbname } = pgConnParams();

      const restore = spawn("psql", ["-h", host, "-p", port, "-U", user, "-d", dbname], {
        env: { ...process.env, PGPASSWORD: password },
      });

      let stderr = "";
      restore.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        restore.on("error", reject);
        restore.on("close", (code) => resolve(code ?? 1));
        objectStream.pipe(createGunzip()).pipe(restore.stdin).on("error", reject);
      });

      await minioClient.removeObject(BUCKETS.assets, backupKey).catch((err) =>
        logger.warn({ err, backupKey }, "cleanup of restored backup object failed"),
      );

      if (exitCode !== 0) {
        throw new ApiError(500, "RESTORE_FAILED", "psql a échoué pendant la restauration", { stderr });
      }

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Database",
        after: { restoredFrom: backupKey },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ status: "ok" });
    } catch (err) {
      next(err);
    }
  },
);
