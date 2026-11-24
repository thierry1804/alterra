import jwt from "jsonwebtoken";

export interface AccessTokenPayload {
  sub: string;
  roleId: string;
  siteId: string | null;
  teamId: string | null;
  /** Date d'émission (secondes), ajoutée par jsonwebtoken. */
  iat?: number;
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

const ENROLLMENT_TTL = "10m";

interface EnrollmentPayload {
  sub: string;
  purpose: "mfa-enroll";
}

/**
 * Jeton à usage restreint remis à un compte dont le rôle exige la MFA mais qui n'a pas encore de
 * second facteur : il ne sert qu'à enrôler l'authentificateur, jamais à appeler l'API (pas de roleId).
 */
export function signEnrollmentToken(userId: string): string {
  const payload: EnrollmentPayload = { sub: userId, purpose: "mfa-enroll" };
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ENROLLMENT_TTL, algorithm: JWT_ALGORITHM });
}

/** Retourne l'id utilisateur d'un jeton d'enrôlement valide, ou null (expiré, falsifié, autre usage). */
export function verifyEnrollmentToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as Partial<EnrollmentPayload>;
    return payload.purpose === "mfa-enroll" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Decode JWT header without verifying signature (tests). */
export function decodeTokenHeader(token: string): jwt.JwtHeader {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string") {
    throw new Error("Invalid token");
  }
  return decoded.header;
}
