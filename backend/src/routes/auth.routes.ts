import { Router } from "express";
import argon2 from "argon2";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { ApiError } from "../middleware/error-handler.js";
import {
  REFRESH_COOKIE,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/auth/refresh.service.js";
import { activateMfa, setupMfa, verifyLoginMfa } from "../services/auth/mfa.service.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().length(6).optional(),
});

const mfaVerifySchema = z.object({
  code: z.string().length(6),
});

authRouter.post("/auth/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, mfaCode } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.active || !(await argon2.verify(user.passwordHash, password))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email ou mot de passe incorrect");
    }

    if (user.role === Role.ADMIN && user.mfaSecret) {
      if (!mfaCode) {
        throw new ApiError(401, "MFA_REQUIRED", "MFA code required for admin login");
      }
      if (!verifyLoginMfa(user.mfaSecret, mfaCode)) {
        throw new ApiError(401, "INVALID_MFA_CODE", "Invalid MFA code");
      }
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      siteId: user.siteId,
      teamId: user.teamId,
    });
    await issueRefreshToken(user.id, res, req.headers["user-agent"]);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

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

authRouter.post("/auth/logout", requireAuth, async (req, res, next) => {
  try {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE], res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

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
