import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  clampDecimals,
  isiLineKey,
  lineGross,
  lineIsi,
  ratePercentLabel,
  roundAmount,
  type IsiSettings,
} from "../lib/isi.js";
import { SYSTEM_ROLE_IDS } from "../services/access/system-roles.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    appSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: { auditLog: { create: vi.fn() } },
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";

const unit: IsiSettings = { rate: new Prisma.Decimal("0.05"), decimals: 0 };
const none: IsiSettings = { rate: new Prisma.Decimal("0.05"), decimals: 2 };
const one: IsiSettings = { rate: new Prisma.Decimal("0.05"), decimals: 1 };

function header(roleId: string) {
  return `Bearer ${signAccessToken({
    sub: "00000000-0000-4000-8000-0000000000f1",
    roleId,
    siteId: null,
    teamId: null,
  })}`;
}

describe("ISI calculation", () => {
  it("rounds the withholding to the Ar per line with 0 decimals", () => {
    expect(lineIsi("221", unit).toString()).toBe("11");
    expect(lineIsi("210", unit).toString()).toBe("11");
    expect(lineIsi("150", unit).toString()).toBe("8");
    expect(lineIsi("119", unit).toString()).toBe("6");
  });

  it("keeps two decimals with 2 decimals", () => {
    expect(lineIsi("221", none).toString()).toBe("11.05");
    expect(lineIsi("150", none).toString()).toBe("7.5");
  });

  it("follows the configured rate", () => {
    const seven: IsiSettings = { rate: new Prisma.Decimal("0.07"), decimals: 2 };
    expect(lineIsi("1000", seven).toString()).toBe("70");
    expect(ratePercentLabel("0.07")).toBe("7");
    expect(ratePercentLabel("0.0525")).toBe("5.25");
  });

  it("rounds amounts half up to the configured number of decimals", () => {
    expect(roundAmount("12.5", 0).toString()).toBe("13");
    expect(roundAmount("12.345", 2).toString()).toBe("12.35");
    expect(lineGross("1234.567", one).toString()).toBe("1234.6");
    expect(lineGross("1234.567", unit).toString()).toBe("1235");
    expect(lineIsi("1234.6", one).toString()).toBe("61.7");
  });

  it("clamps the number of decimals to 0-2", () => {
    expect(clampDecimals(5)).toBe(2);
    expect(clampDecimals(-1)).toBe(0);
    expect(clampDecimals(1.5)).toBe(0);
    expect(clampDecimals(1)).toBe(1);
  });

  it("makes the net of a worker the sum of the nets of its lines", () => {
    const lines = ["221", "1200", "119"];
    const gross = lines.reduce((sum, value) => sum.add(value), new Prisma.Decimal(0));
    const isi = lines.reduce((sum, value) => sum.add(lineIsi(value, unit)), new Prisma.Decimal(0));
    expect(gross.toString()).toBe("1540");
    expect(isi.toString()).toBe("77");
    expect(gross.sub(isi).toString()).toBe("1463");
  });

  it("groups pointages by worker, sub-activity and unit rate", () => {
    const base = { workerId: "w", subActivityId: "s", unitRateSnapshot: new Prisma.Decimal("30") };
    expect(isiLineKey(base)).toBe(isiLineKey({ ...base, unitRateSnapshot: "30" }));
    expect(isiLineKey(base)).not.toBe(isiLineKey({ ...base, unitRateSnapshot: "40" }));
  });
});

describe("ISI settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
    vi.mocked(prisma.appSetting.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.appSetting.upsert).mockImplementation((async (args: {
      update: { isiRate: Prisma.Decimal; amountDecimals: number };
    }) => ({
      appName: "ALTERRA",
      isiRate: args.update.isiRate,
      amountDecimals: args.update.amountDecimals,
      bioValidationRequired: true,
      updatedAt: new Date(),
    })) as never);
  });

  it("lets an administrator change the rate and the decimals and logs it", async () => {
    const res = await request(createApp())
      .patch("/api/v1/app-settings/isi")
      .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN))
      .send({ ratePercent: 7, decimals: 2 });

    expect(res.status).toBe(200);
    expect(res.body.isiRatePercent).toBe(7);
    expect(res.body.amountDecimals).toBe(2);
    expect(res.body.isiRounding).toBe("NONE");
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ amountDecimals: 2 }),
      }),
    );
    expect(basePrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "AppSetting",
          before: { isiRatePercent: 5, amountDecimals: 0 },
          after: { isiRatePercent: 7, amountDecimals: 2 },
        }),
      }),
    );
  });

  it("refuses a rate outside 0-100 % or a number of decimals outside 0-2", async () => {
    for (const body of [
      { ratePercent: 120, decimals: 0 },
      { ratePercent: -1, decimals: 0 },
      { ratePercent: 5, decimals: 3 },
      { ratePercent: 5, decimals: 1.5 },
      { ratePercent: 5, rounding: "UP" },
      { ratePercent: 5 },
    ]) {
      const res = await request(createApp())
        .patch("/api/v1/app-settings/isi")
        .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN))
        .send(body);
      expect(res.status).toBe(422);
    }
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it("still accepts the former rounding field from clients that were not updated", async () => {
    const res = await request(createApp())
      .patch("/api/v1/app-settings/isi")
      .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN))
      .send({ ratePercent: 5, rounding: "UNIT" });
    expect(res.status).toBe(200);
    expect(res.body.amountDecimals).toBe(0);
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ amountDecimals: 0 }) }),
    );
  });

  it("keeps the setting from roles without the settings permission", async () => {
    for (const roleId of [SYSTEM_ROLE_IDS.FINANCE, SYSTEM_ROLE_IDS.CHEF_SERVICE]) {
      const res = await request(createApp())
        .patch("/api/v1/app-settings/isi")
        .set("Authorization", header(roleId))
        .send({ ratePercent: 5, decimals: 0 });
      expect(res.status).toBe(403);
    }
  });
});
