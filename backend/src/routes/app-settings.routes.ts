import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import { BUCKETS, minioClient } from "../services/storage/minio.js";
import { iconUploadUrl } from "../services/storage/presigned-url.service.js";
import { DEFAULT_ICON_BASE64, DEFAULT_ICON_CONTENT_TYPE } from "../assets/default-icon.js";

export const appSettingsRouter = Router();

const SETTINGS_ID = "singleton";
const DEFAULT_APP_NAME = "ALTERRA";
const ICON_EXTENSIONS = ["png", "jpg", "svg", "webp"] as const;

const CONTENT_TYPE_BY_EXT: Record<(typeof ICON_EXTENSIONS)[number], string> = {
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
};

const updateAppSettingSchema = z.object({
  appName: z.string().min(1).max(60),
});

const iconUploadUrlSchema = z.object({
  ext: z.enum(ICON_EXTENSIONS),
});

const confirmIconSchema = z.object({
  iconKey: z.string().min(1),
});

function assertIconKeyPrefix(iconKey: string) {
  if (!iconKey.startsWith("app-settings/icon/")) {
    throw new ApiError(422, "INVALID_ICON_KEY", "Clé icône invalide");
  }
}

async function getAppSetting() {
  const row = await prisma.appSetting.findUnique({ where: { id: SETTINGS_ID } });
  return {
    appName: row?.appName ?? DEFAULT_APP_NAME,
    iconKey: row?.iconKey ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

appSettingsRouter.get("/app-settings", async (_req, res, next) => {
  try {
    const settings = await getAppSetting();
    res.json({ appName: settings.appName, iconUpdatedAt: settings.updatedAt });
  } catch (err) {
    next(err);
  }
});

appSettingsRouter.patch(
  "/app-settings",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(updateAppSettingSchema),
  async (req, res, next) => {
    try {
      const before = await getAppSetting();
      const { appName } = req.body as z.infer<typeof updateAppSettingSchema>;

      const updated = await prisma.appSetting.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, appName },
        update: { appName },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "AppSetting",
        entityId: SETTINGS_ID,
        before: { appName: before.appName },
        after: { appName: updated.appName },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ appName: updated.appName, iconUpdatedAt: updated.updatedAt });
    } catch (err) {
      next(err);
    }
  },
);

appSettingsRouter.post(
  "/app-settings/icon-upload-url",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(iconUploadUrlSchema),
  async (req, res, next) => {
    try {
      const { ext } = req.body as z.infer<typeof iconUploadUrlSchema>;
      const result = await iconUploadUrl(ext);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

appSettingsRouter.post(
  "/app-settings/icon",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(confirmIconSchema),
  async (req, res, next) => {
    try {
      const { iconKey } = req.body as z.infer<typeof confirmIconSchema>;
      assertIconKeyPrefix(iconKey);

      const before = await getAppSetting();

      const updated = await prisma.appSetting.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, iconKey },
        update: { iconKey },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "AppSetting",
        entityId: SETTINGS_ID,
        before: { iconKey: before.iconKey },
        after: { iconKey: updated.iconKey },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ appName: updated.appName, iconUpdatedAt: updated.updatedAt });
    } catch (err) {
      next(err);
    }
  },
);

appSettingsRouter.get("/app-settings/icon", async (_req, res, next) => {
  try {
    const settings = await getAppSetting();

    if (!settings.iconKey) {
      res.setHeader("Content-Type", DEFAULT_ICON_CONTENT_TYPE);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(Buffer.from(DEFAULT_ICON_BASE64, "base64"));
      return;
    }

    const ext = settings.iconKey.split(".").pop() as (typeof ICON_EXTENSIONS)[number] | undefined;
    const contentType = (ext && CONTENT_TYPE_BY_EXT[ext]) || "application/octet-stream";

    const stream = await minioClient.getObject(BUCKETS.assets, settings.iconKey);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300");
    stream.on("error", next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

appSettingsRouter.get("/manifest.webmanifest", async (_req, res, next) => {
  try {
    const settings = await getAppSetting();
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      name: `${settings.appName} Terrain`,
      short_name: settings.appName,
      description: `Pointage et synchronisation terrain ${settings.appName}`,
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#189060",
      theme_color: "#189060",
      lang: "fr",
      icons: [
        { src: "/api/v1/app-settings/icon", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/api/v1/app-settings/icon", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    });
  } catch (err) {
    next(err);
  }
});
