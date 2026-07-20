import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  siteId: string | null;
}

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TTL = (process.env.JWT_ACCESS_TTL ?? "15m") as jwt.SignOptions["expiresIn"];
const REFRESH_TTL = (process.env.JWT_REFRESH_TTL ?? "7d") as jwt.SignOptions["expiresIn"];

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT_SECRET / JWT_REFRESH_SECRET must be set");
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}
