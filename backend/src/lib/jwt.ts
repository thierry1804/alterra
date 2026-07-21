import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  siteId: string | null;
}

const ACCESS_SECRET = process.env.JWT_SECRET!;
const ACCESS_TTL = (process.env.JWT_ACCESS_TTL ?? "15m") as jwt.SignOptions["expiresIn"];
const JWT_ALGORITHM = "HS256" as const;

if (!ACCESS_SECRET) {
  throw new Error("JWT_SECRET must be set");
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
    algorithm: JWT_ALGORITHM,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET, { algorithms: [JWT_ALGORITHM] }) as AccessTokenPayload;
}

/** Decode JWT header without verifying signature (tests). */
export function decodeTokenHeader(token: string): jwt.JwtHeader {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string") {
    throw new Error("Invalid token");
  }
  return decoded.header;
}
