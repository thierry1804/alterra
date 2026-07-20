import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error-handler.js";

export const authRouter = Router();

const REFRESH_COOKIE = "refreshToken";
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().length(6).optional(),
});

authRouter.post("/auth/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.active || !(await argon2.verify(user.passwordHash, password))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email ou mot de passe incorrect");
    }

    // TODO V1: vérifier mfaCode si user.mfaSecret est défini (obligatoire ADMIN).

    const accessToken = signAccessToken({ sub: user.id, role: user.role, siteId: user.siteId });
    const refreshToken = signRefreshToken(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: REFRESH_MAX_AGE_MS,
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        siteId: user.siteId,
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

    const { sub } = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || !user.active) throw new ApiError(401, "INVALID_REFRESH_TOKEN", "User not found or inactive");

    const accessToken = signAccessToken({ sub: user.id, role: user.role, siteId: user.siteId });
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/auth/logout", requireAuth, (_req, res) => {
  res.clearCookie(REFRESH_COOKIE);
  res.status(204).send();
});

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
    });
  } catch (err) {
    next(err);
  }
});
