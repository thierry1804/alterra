import { Readable } from "node:stream";
import JSZip from "jszip";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({ prisma: {}, basePrisma: {} }));
vi.mock("../lib/prisma-base.js", () => ({ basePrisma: { auditLog: { create: vi.fn() } } }));
vi.mock("../services/payments/activity-invoices.service.js", () => ({
  listInvoices: vi.fn(),
  listInvoicesForZip: vi.fn(),
}));
vi.mock("../services/storage/presigned-url.service.js", () => ({
  getReportStream: vi.fn(),
}));

import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { listInvoicesForZip } from "../services/payments/activity-invoices.service.js";
import { setRoleAccessLoader } from "../services/access/access.service.js";
import { getReportStream } from "../services/storage/presigned-url.service.js";
import {
  SYSTEM_ROLES,
  SYSTEM_ROLE_IDS,
  systemRolePermissions,
} from "../services/access/system-roles.js";

const header = () =>
  `Bearer ${signAccessToken({
    sub: "00000000-0000-4000-8000-000000000001",
    roleId: SYSTEM_ROLE_IDS.ADMIN,
    siteId: null,
    teamId: null,
  })}`;

/** Binaire à ouvrir de bout en bout : renvoie le corps de la réponse en Buffer. */
function binary(res: request.Response, done: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => done(null, Buffer.concat(chunks)));
}

describe("GET /invoices/download-all (archive ZIP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRoleAccessLoader(async (roleId) => {
      const role = SYSTEM_ROLES.find((entry) => entry.id === roleId);
      return role
        ? {
            roleId,
            roleName: role.name,
            scope: role.scope,
            mfaRequired: role.mfaRequired,
            permissions: systemRolePermissions(roleId),
          }
        : null;
    });
  });

  it("renvoie un vrai ZIP lisible contenant les PDF, avec des noms uniques", async () => {
    vi.mocked(listInvoicesForZip).mockResolvedValue([
      {
        id: "11111111-aaaa",
        fileKey: "k1",
        activityLabel: "Trouaison",
        siteShortCode: "MNK",
        periodIso: "S47",
      },
      {
        id: "22222222-bbbb",
        fileKey: "k2",
        activityLabel: "Trouaison",
        siteShortCode: "MNK",
        periodIso: "S47",
      },
    ] as never);
    vi.mocked(getReportStream).mockImplementation(
      async (key: string) => Readable.from([Buffer.from(`%PDF-${key}`)]) as never,
    );

    const res = await request(createApp())
      .get("/api/v1/invoices/download-all?periodIso=S47")
      .set("Authorization", header())
      .buffer(true)
      .parse(binary);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/zip");
    expect(res.headers["content-disposition"]).toContain("factures_S47.zip");

    const zip = await JSZip.loadAsync(res.body as Buffer);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(["facture_Trouaison_MNK.pdf", "facture_Trouaison_MNK_22222222.pdf"]);
    expect(await zip.file("facture_Trouaison_MNK.pdf")!.async("string")).toBe("%PDF-k1");
  });

  it("répond 404 quand la période n'a aucune facture", async () => {
    vi.mocked(listInvoicesForZip).mockResolvedValue([] as never);
    const res = await request(createApp())
      .get("/api/v1/invoices/download-all?periodIso=S01")
      .set("Authorization", header());
    expect(res.status).toBe(404);
  });
});
