import { Router } from "express";
import { z } from "zod";
import { spawn } from "node:child_process";
import { Transform } from "node:stream";
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

const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

/** Refuse tout fichier qui n'est pas une archive pg_dump au format custom (en-tête "PGDMP"). */
function requirePgDumpHeader() {
  let checked = false;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      if (!checked) {
        if (chunk.length < 5 || chunk.subarray(0, 5).toString("latin1") !== "PGDMP") {
          return cb(new ApiError(422, "INVALID_BACKUP_FILE", "Fichier invalide : sauvegarde .dump ALTERRA attendue"));
        }
        checked = true;
      }
      cb(null, chunk);
    },
  });
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
    ["-h", host, "-p", port, "-U", user, "-d", dbname, "-Fc", "--no-owner", "--no-privileges"],
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
        next(new ApiError(500, "BACKUP_FAILED", "pg_dump a échoué"));
      } else {
        res.destroy();
      }
    }
  });

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="alterra-backup-${timestampSuffix()}.dump"`);

  dump.stdout.pipe(res);

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

    try {
      assertBackupKeyPrefix(backupKey);
      const stat = await minioClient.statObject(BUCKETS.assets, backupKey);
      if (stat.size > MAX_BACKUP_BYTES) {
        await minioClient.removeObject(BUCKETS.assets, backupKey).catch(() => undefined);
        throw new ApiError(413, "BACKUP_TOO_LARGE", "Fichier de sauvegarde trop volumineux");
      }
      const objectStream = await minioClient.getObject(BUCKETS.assets, backupKey);
      const { host, port, user, password, dbname } = pgConnParams();

      // pg_restore (format custom) n'exécute que des commandes d'archive — contrairement à psql
      // qui interpréterait des méta-commandes (\\!cmd) d'un fichier fourni par l'utilisateur.
      const restore = spawn(
        "pg_restore",
        ["-h", host, "-p", port, "-U", user, "-d", dbname, "--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", "--exit-on-error"],
        {
          env: { ...process.env, PGPASSWORD: password },
        },
      );

      let stderr = "";
      restore.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      let exitCode: number;
      try {
        exitCode = await new Promise<number>((resolve, reject) => {
          const guard = requirePgDumpHeader();
          const fail = (err: Error) => {
            restore.kill();
            reject(err);
          };
          restore.on("error", fail);
          restore.on("close", (code) => resolve(code ?? 1));
          objectStream.on("error", fail);
          guard.on("error", fail);
          restore.stdin.on("error", () => undefined);
          objectStream.pipe(guard).pipe(restore.stdin);
        });
      } finally {
        await minioClient.removeObject(BUCKETS.assets, backupKey).catch((err) =>
          logger.warn({ err, backupKey }, "cleanup of backup object failed"),
        );
      }

      if (exitCode !== 0) {
        logger.error({ exitCode, stderr }, "pg_restore failed");
        throw new ApiError(500, "RESTORE_FAILED", "La restauration a échoué — la base n'a pas été modifiée (transaction annulée)");
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
