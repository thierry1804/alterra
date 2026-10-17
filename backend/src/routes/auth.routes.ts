import { Router } from "express";
import argon2 from "argon2";
import { Role } from "@prisma/client";
import { z } from "zod";
import { basePrisma, prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { ApiError } from "../middleware/error-handler.js";
import {
  assertLoginNotLocked,
  clearLoginFailures,
  recordLoginFailure,
} from "../lib/login-lockout.js";
import {
  REFRESH_COOKIE,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/auth/refresh.service.js";
import { activateMfa, setupMfa, verifyLoginMfa } from "../services/auth/mfa.service.js";
import { confirmPasswordReset, requestPasswordReset } from "../services/auth/password-reset.service.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().length(6).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const mfaVerifySchema = z.object({
  code: z.string().length(6),
});

let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= argon2.hash("alterra-dummy-password", { type: argon2.argon2id });
  return dummyHash;
}

authRouter.post("/auth/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, mfaCode } = req.body;
    await assertLoginNotLocked(email);
    const user = await basePrisma.user.findUnique({ where: { email } });

    // Toujours vérifier un hash (factice si compte inconnu) : temps de réponse identique, pas d'énumération.
    const passwordOk = await argon2.verify(user?.passwordHash ?? (await getDummyHash()), password);
    if (!user || !user.active || !passwordOk) {
      await recordLoginFailure(email);
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email ou mot de passe incorrect");
    }

    if (user.role === Role.ADMIN && user.mfaSecret) {
      if (!mfaCode) {
        throw new ApiError(401, "MFA_REQUIRED", "MFA code required for admin login");
      }
      if (!verifyLoginMfa(user.mfaSecret, mfaCode)) {
        await recordLoginFailure(email);
        throw new ApiError(401, "INVALID_MFA_CODE", "Invalid MFA code");
      }
    }

    await clearLoginFailures(email);
    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      siteId: user.siteId,
      teamId: user.teamId,
    });
    await issueRefreshToken(user.id, res, req.headers["user-agent"]);

    await basePrisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        siteId: user.siteId,
        teamId: user.teamId,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/auth/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new ApiError(401, "MISSING_REFRESH_TOKEN", "No refresh cookie present");

    const { accessToken } = await rotateRefreshToken(token, res);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// Pas de requireAuth : la déconnexion doit fonctionner avec un jeton d'accès expiré ou absent (écran verrouillé
// de la PWA). Seul le cookie de rafraîchissement, qui identifie la session, est révoqué.
authRouter.post("/auth/logout", async (req, res, next) => {
  try {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE], res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  "/auth/forgot-password",
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const allowedOrigins = (process.env.ADMIN_ORIGIN ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      const requestOrigin = req.headers.origin;
      // Préfère l'origine réelle de l'appelant (celle depuis laquelle la demande a été faite) si elle
      // est autorisée ; sinon retombe sur la première origine ADMIN_ORIGIN déclarée publique (https).
      const adminOrigin =
        (requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : undefined) ??
        allowedOrigins.find((o) => o.startsWith("https://")) ??
        allowedOrigins[0];
      const resetUrlBase = `${adminOrigin}/reset-password`;
      await requestPasswordReset(req.body.email, resetUrlBase);
      // Toujours 200 — ne jamais révéler si l'adresse correspond à un compte.
      res.json({ message: "Si ce compte existe, un email de réinitialisation a été envoyé." });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/auth/reset-password",
  validate(resetPasswordConfirmSchema),
  async (req, res, next) => {
    try {
      await confirmPasswordReset(req.body.token, req.body.password);
      res.json({ message: "Mot de passe réinitialisé." });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post("/auth/mfa/setup", requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
    if (!user.email) {
      throw new ApiError(400, "EMAIL_REQUIRED", "Admin account must have an email for MFA setup");
    }
    const { otpauthUrl, qrCodeDataUrl } = await setupMfa(user.id, user.email);
    res.json({ otpauthUrl, qrCodeDataUrl });
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  "/auth/mfa/verify",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(mfaVerifySchema),
  async (req, res, next) => {
    try {
      await activateMfa(req.user!.sub, req.body.code);
      res.json({ activated: true });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      siteId: user.siteId,
      teamId: user.teamId,
    });
  } catch (err) {
    next(err);
  }
});
