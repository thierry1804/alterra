import { BioProvider, Prisma, Role } from "@prisma/client";
import type { AccessTokenPayload } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";

export interface TemplateSyncItem {
  workerId: string;
  descriptor: number[];
  source: BioProvider;
  capturedAt: string;
  expiresAt: string;
}

const DESCRIPTOR_LENGTH = 128;

export function parseDescriptor(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length !== DESCRIPTOR_LENGTH) {
    throw new ApiError(422, "INVALID_DESCRIPTOR", "Le descripteur doit contenir 128 valeurs");
  }
  return raw.map((value) => Number(value));
}

export function encodeTemplateData(descriptor: number[]): Buffer {
  return Buffer.from(JSON.stringify(descriptor), "utf8");
}

export function decodeTemplateData(data: Buffer): number[] {
  return parseDescriptor(JSON.parse(data.toString("utf8")));
}

function workerScopeFilter(user: AccessTokenPayload): Prisma.WorkerWhereInput {
  if (user.role === Role.CHEF_EQUIPE && user.teamId) {
    return { teamId: user.teamId };
  }
  if (user.role === Role.CHEF_SERVICE && user.siteId) {
    return { siteId: user.siteId };
  }
  return {};
}

export async function listTemplatesForSync(user: AccessTokenPayload): Promise<TemplateSyncItem[]> {
  const now = new Date();
  const workerScope = workerScopeFilter(user);

  const templates = await prisma.biometricTemplate.findMany({
    where: {
      expiresAt: { gt: now },
      worker: {
        deletedAt: null,
        ...workerScope,
      },
    },
    orderBy: [{ workerId: "asc" }],
  });

  return templates.map((template) => ({
    workerId: template.workerId,
    descriptor: decodeTemplateData(Buffer.from(template.templateData)),
    source: template.source,
    capturedAt: template.capturedAt.toISOString(),
    expiresAt: template.expiresAt.toISOString(),
  }));
}

export async function upsertWorkerTemplate(input: {
  workerId: string;
  descriptor: number[];
  source?: BioProvider;
  expiresAt?: Date;
}): Promise<void> {
  const worker = await prisma.worker.findFirst({
    where: { id: input.workerId, deletedAt: null },
  });
  if (!worker) throw new ApiError(404, "NOT_FOUND", "Travailleur introuvable");

  const capturedAt = new Date();
  const expiresAt =
    input.expiresAt ?? new Date(capturedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

  await prisma.biometricTemplate.upsert({
    where: { workerId: input.workerId },
    create: {
      workerId: input.workerId,
      templateData: encodeTemplateData(input.descriptor),
      source: input.source ?? BioProvider.MOCK,
      capturedAt,
      expiresAt,
    },
    update: {
      templateData: encodeTemplateData(input.descriptor),
      source: input.source ?? BioProvider.MOCK,
      capturedAt,
      expiresAt,
    },
  });
}

/** Descripteur déterministe pour seeds/tests (128 dimensions). */
export function buildMockDescriptor(seed: string): number[] {
  const values: number[] = [];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  for (let index = 0; index < DESCRIPTOR_LENGTH; index += 1) {
    hash = (hash * 1664525 + 1013904223 + index) >>> 0;
    values.push(Number(((hash % 1000) / 1000).toFixed(6)));
  }
  return values;
}
