import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";
import request from "supertest";

import { makeTestApp, cleanUpTempDirs } from "./helpers.js";

afterAll(cleanUpTempDirs);

// The settings page reads the bar it was handed, so a reply that leaves fields
// out silently turns settings back off. That is what went wrong before.
describe("signing in", () => {
  let app: Express;
  let barId: number;

  beforeAll(async () => {
    app = makeTestApp().app;

    const created = await request(app).post("/api/bars").send({
      name: "Garden Bar",
      bartenderPassword: "shaker",
      guestPassword: "gin",
      language: "da",
    });

    expect(created.status).toBe(201);
    barId = created.body.id;

    await request(app)
      .put(`/api/bars/${barId}`)
      .send({ skipApproval: true })
      .expect(200);
  });

  it("hands back the whole bar when the bar is made", async () => {
    const res = await request(app).post("/api/bars").send({
      name: "Kitchen Bar",
      bartenderPassword: "shaker",
      guestPassword: "gin",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Kitchen Bar",
      language: "en",
      skip_approval: 0,
    });
    expect(res.body.created_at).toBeTruthy();
  });

  for (const [who, body] of [
    ["bartender", { password: "shaker" }],
    ["guest", { password: "gin", customerName: "Ada" }],
  ] as const) {
    it(`hands the ${who} the whole bar, settings and all`, async () => {
      const res = await request(app)
        .post(`/api/auth/${who}`)
        .send({ barId, ...body });

      expect(res.status).toBe(200);
      expect(res.body.userType).toBe(who);
      expect(res.body.bar).toMatchObject({
        id: barId,
        name: "Garden Bar",
        language: "da",
        skip_approval: 1,
      });
    });
  }

  it("never sends the stored passwords back", async () => {
    const res = await request(app)
      .post("/api/auth/bartender")
      .send({ barId, password: "shaker" });

    expect(JSON.stringify(res.body)).not.toMatch(/password_hash/);
  });

  it("turns away the wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/bartender")
      .send({ barId, password: "wrong" });

    expect(res.status).toBe(401);
  });
});
