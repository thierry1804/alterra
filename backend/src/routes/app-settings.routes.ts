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
import {
  iconUploadUrl,
  loginAssetUploadUrl,
  type LoginAssetSlot,
} from "../services/storage/presigned-url.service.js";
import { DEFAULT_ICON_BASE64, DEFAULT_ICON_CONTENT_TYPE } from "../assets/default-icon.js";
import { readDefaultLoginImage, DEFAULT_LOGIN_IMAGES } from "../assets/default-login-images.js";

export const appSettingsRouter = Router();

const SETTINGS_ID = "singleton";
const DEFAULT_APP_NAME = "ALTERRA";
const ICON_MAX_BYTES = 2 * 1024 * 1024;
const ICON_EXTENSIONS = ["png", "jpg", "svg", "webp"] as const;

const CONTENT_TYPE_BY_EXT: Record<(typeof ICON_EXTENSIONS)[number], string> = {
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
};

const LOGIN_ASSET_MAX_BYTES = 5 * 1024 * 1024;
const LOGIN_ASSET_EXTENSIONS = ["png", "jpg", "webp"] as const;

const LOGIN_ASSET_CONTENT_TYPE_BY_EXT: Record<(typeof LOGIN_ASSET_EXTENSIONS)[number], string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/** Un slot = un champ en base + un préfixe de clé MinIO + une image par défaut. */
const LOGIN_ASSET_SLOTS: Record<LoginAssetSlot, { field: string; urlSegment: string }> = {
  loginBackground: { field: "loginBackgroundKey", urlSegment: "login-background" },
  loginBranch: { field: "loginBranchKey", urlSegment: "login-branch" },
  loginLeaf: { field: "loginLeafKey", urlSegment: "login-leaf" },
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
    loginBackgroundKey: row?.loginBackgroundKey ?? null,
    loginBranchKey: row?.loginBranchKey ?? null,
    loginLeafKey: row?.loginLeafKey ?? null,
    mapTilerKey: row?.mapTilerKey ?? null,
    bioValidationRequired: row?.bioValidationRequired ?? true,
    updatedAt: row?.updatedAt ?? null,
  };
}

/** Un seul horodatage de ligne sert de version de cache pour les 4 images (icône + 3 visuels de login). */
function settingsResponse(settings: Awaited<ReturnType<typeof getAppSetting>>) {
  return {
    appName: settings.appName,
    iconUpdatedAt: settings.updatedAt,
    loginBackgroundUpdatedAt: settings.updatedAt,
    loginBranchUpdatedAt: settings.updatedAt,
    loginLeafUpdatedAt: settings.updatedAt,
    mapTilerKeyConfigured: Boolean(settings.mapTilerKey),
    bioValidationRequired: settings.bioValidationRequired,
  };
}

appSettingsRouter.get("/app-settings", async (_req, res, next) => {
  try {
    const settings = await getAppSetting();
    res.json(settingsResponse(settings));
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

      res.json(
        settingsResponse({ ...before, appName: updated.appName, updatedAt: updated.updatedAt }),
      );
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

      const stat = await minioClient.statObject(BUCKETS.assets, iconKey).catch(() => null);
      if (!stat) throw new ApiError(422, "ICON_NOT_UPLOADED", "Fichier icône introuvable");
      if (stat.size > ICON_MAX_BYTES) {
        await minioClient.removeObject(BUCKETS.assets, iconKey).catch(() => undefined);
        throw new ApiError(413, "ICON_TOO_LARGE", "Icône trop volumineuse (2 Mo maximum)");
      }

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

      res.json(
        settingsResponse({ ...before, iconKey: updated.iconKey, updatedAt: updated.updatedAt }),
      );
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
    // Un SVG ouvert directement s'exécute dans l'origine de l'API : on le neutralise.
    res.setHeader(
      "Content-Security-Policy",
      "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    stream.on("error", next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

const loginAssetUploadUrlSchema = z.object({
  ext: z.enum(LOGIN_ASSET_EXTENSIONS),
});

const confirmLoginAssetSchema = z.object({
  key: z.string().min(1),
});

/** Enregistre le trio upload-url / confirmation / service pour un slot d'image de login donné. */
function registerLoginAssetRoutes(slot: LoginAssetSlot) {
  const { field, urlSegment } = LOGIN_ASSET_SLOTS[slot];
  const keyPrefix = `app-settings/${slot}/`;

  appSettingsRouter.post(
    `/app-settings/${urlSegment}/upload-url`,
    requireAuth,
    requireRole(Role.ADMIN),
    validate(loginAssetUploadUrlSchema),
    async (req, res, next) => {
      try {
        const { ext } = req.body as z.infer<typeof loginAssetUploadUrlSchema>;
        const result = await loginAssetUploadUrl(slot, ext);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  appSettingsRouter.post(
    `/app-settings/${urlSegment}`,
    requireAuth,
    requireRole(Role.ADMIN),
    validate(confirmLoginAssetSchema),
    async (req, res, next) => {
      try {
        const { key } = req.body as z.infer<typeof confirmLoginAssetSchema>;
        if (!key.startsWith(keyPrefix)) {
          throw new ApiError(422, "INVALID_ASSET_KEY", "Clé de visuel invalide");
        }

        const stat = await minioClient.statObject(BUCKETS.assets, key).catch(() => null);
        if (!stat) throw new ApiError(422, "ASSET_NOT_UPLOADED", "Fichier introuvable");
        if (stat.size > LOGIN_ASSET_MAX_BYTES) {
          await minioClient.removeObject(BUCKETS.assets, key).catch(() => undefined);
          throw new ApiError(413, "ASSET_TOO_LARGE", "Fichier trop volumineux (5 Mo maximum)");
        }

        const before = await getAppSetting();

        const updated = await prisma.appSetting.upsert({
          where: { id: SETTINGS_ID },
          create: { id: SETTINGS_ID, [field]: key },
          update: { [field]: key },
        });

        await writeAuditLog({
          userId: req.user!.sub,
          action: "UPDATE",
          entityType: "AppSetting",
          entityId: SETTINGS_ID,
          before: { [field]: (before as Record<string, unknown>)[field] },
          after: { [field]: (updated as Record<string, unknown>)[field] },
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json(settingsResponse({ ...before, updatedAt: updated.updatedAt }));
      } catch (err) {
        next(err);
      }
    },
  );

  appSettingsRouter.get(`/app-settings/${urlSegment}`, async (_req, res, next) => {
    try {
      const settings = await getAppSetting();
      const key = (settings as Record<string, unknown>)[field] as string | null;

      if (!key) {
        const { contentType } = DEFAULT_LOGIN_IMAGES[slot];
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=300");
        res.send(readDefaultLoginImage(slot));
        return;
      }

      const ext = key.split(".").pop() as (typeof LOGIN_ASSET_EXTENSIONS)[number] | undefined;
      const contentType =
        (ext && LOGIN_ASSET_CONTENT_TYPE_BY_EXT[ext]) || "application/octet-stream";

      const stream = await minioClient.getObject(BUCKETS.assets, key);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
      stream.on("error", next);
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  });
}

(Object.keys(LOGIN_ASSET_SLOTS) as LoginAssetSlot[]).forEach(registerLoginAssetRoutes);

const setMapKeySchema = z.object({
  apiKey: z.string().min(1).max(200),
});

appSettingsRouter.post(
  "/app-settings/map-key",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(setMapKeySchema),
  async (req, res, next) => {
    try {
      const { apiKey } = req.body as z.infer<typeof setMapKeySchema>;
      const before = await getAppSetting();

      const updated = await prisma.appSetting.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, mapTilerKey: apiKey },
        update: { mapTilerKey: apiKey },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "AppSetting",
        entityId: SETTINGS_ID,
        before: { mapTilerKeyConfigured: Boolean(before.mapTilerKey) },
        after: { mapTilerKeyConfigured: true },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(settingsResponse({ ...before, mapTilerKey: updated.mapTilerKey }));
    } catch (err) {
      next(err);
    }
  },
);

appSettingsRouter.delete(
  "/app-settings/map-key",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res, next) => {
    try {
      const before = await getAppSetting();

      const updated = await prisma.appSetting.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, mapTilerKey: null },
        update: { mapTilerKey: null },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "AppSetting",
        entityId: SETTINGS_ID,
        before: { mapTilerKeyConfigured: Boolean(before.mapTilerKey) },
        after: { mapTilerKeyConfigured: false },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(settingsResponse({ ...before, mapTilerKey: updated.mapTilerKey }));
    } catch (err) {
      next(err);
    }
  },
);

const setBioValidationRequiredSchema = z.object({
  enabled: z.boolean(),
});

appSettingsRouter.patch(
  "/app-settings/bio-validation-required",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(setBioValidationRequiredSchema),
  async (req, res, next) => {
    try {
      const { enabled } = req.body as z.infer<typeof setBioValidationRequiredSchema>;
      const before = await getAppSetting();

      const updated = await prisma.appSetting.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, bioValidationRequired: enabled },
        update: { bioValidationRequired: enabled },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "AppSetting",
        entityId: SETTINGS_ID,
        before: { bioValidationRequired: before.bioValidationRequired },
        after: { bioValidationRequired: updated.bioValidationRequired },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(
        settingsResponse({
          ...before,
          bioValidationRequired: updated.bioValidationRequired,
          updatedAt: updated.updatedAt,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

appSettingsRouter.get("/app-settings/map-key", requireAuth, async (_req, res, next) => {
  try {
    const settings = await getAppSetting();
    if (settings.mapTilerKey) {
      res.json({ apiKey: settings.mapTilerKey, source: "database" });
      return;
    }
    const envKey = process.env.VITE_MAPTILER_KEY;
    if (envKey) {
      res.json({ apiKey: envKey, source: "env" });
      return;
    }
    res.json({ apiKey: null, source: "none" });
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
        {
          src: "/api/v1/app-settings/icon",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    });
  } catch (err) {
    next(err);
  }
});
