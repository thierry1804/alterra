import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("GET /api/v1/health", () => {
  it("responds with status ok or degraded", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/health");
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toMatch(/ok|degraded/);
  });
});
