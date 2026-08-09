import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { makeTestApp, cleanUpTempDirs, seedBar } from "./helpers.js";
import type { Express } from "express";
import type { Db } from "../src/db/queries.js";

afterAll(cleanUpTempDirs);

describe("what a host can set on a bar", () => {
  let app: Express;
  let db: Db;
  let barId: number;
  let drinkId: number;

  beforeEach(() => {
    ({ app, db } = makeTestApp());
    ({ barId, drinkId } = seedBar(db));
    app.locals.realtime = { broadcast: () => {} };
  });

  const setBar = (body: Record<string, unknown>) =>
    request(app).put(`/api/bars/${barId}`).send(body);

  const order = (customerName = "Mads") =>
    request(app)
      .post("/api/orders")
      .send({ barId, customerName, drinkId, drinkTitle: "Negroni" });

  describe("last orders", () => {
    it("stops taking new ones, and says so plainly", async () => {
      await setBar({ ordersClosed: true });

      const res = await order();

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/stopped taking orders/i);
    });

    // The queue has to keep working, or drinks already ordered never get made.
    it("leaves what is already in the queue alone", async () => {
      const placed = await order();
      expect(placed.status).toBe(201);

      await setBar({ ordersClosed: true });

      const served = await request(app)
        .patch(`/api/orders/${placed.body.id}/status`)
        .send({ barId, status: "accepted" });

      expect(served.status).toBe(200);
    });

    it("opens again when it is turned back off", async () => {
      await setBar({ ordersClosed: true });
      await setBar({ ordersClosed: false });

      expect((await order()).status).toBe(201);
    });
  });

  describe("how many at a time", () => {
    it("is one unless the bar says otherwise", async () => {
      expect((await order()).status).toBe(201);
      expect((await order()).status).toBe(400);
    });

    it("lets a bar allow more", async () => {
      await setBar({ maxActiveOrders: 2 });

      expect((await order()).status).toBe(201);
      expect((await order()).status).toBe(201);
      expect((await order()).status).toBe(400);
    });

    it("counts each guest on their own", async () => {
      await order("Mads");

      expect((await order("Astrid")).status).toBe(201);
    });

    it("refuses a limit nobody meant to type", async () => {
      expect((await setBar({ maxActiveOrders: 0 })).status).toBe(400);
      expect((await setBar({ maxActiveOrders: 99 })).status).toBe(400);
      expect((await setBar({ maxActiveOrders: 1.5 })).status).toBe(400);
    });
  });

  describe("the guest link", () => {
    const tokenOf = (url: string) => new URL(url).searchParams.get("token");

    it("keeps working on a code that was printed before it could be rotated", async () => {
      const qr = await request(app).get(`/api/bars/${barId}/qrcode`);

      const login = await request(app)
        .post(`/api/bars/${barId}/guest-token-login`)
        .send({ token: tokenOf(qr.body.url), customerName: "Mads" });

      expect(login.status).toBe(200);
    });

    it("turns the old link off once a new one is made", async () => {
      const before = await request(app).get(`/api/bars/${barId}/qrcode`);
      const oldToken = tokenOf(before.body.url);

      await request(app).post(`/api/bars/${barId}/rotate-guest-link`);

      const after = await request(app).get(`/api/bars/${barId}/qrcode`);
      expect(tokenOf(after.body.url)).not.toBe(oldToken);

      const withOld = await request(app)
        .post(`/api/bars/${barId}/guest-token-login`)
        .send({ token: oldToken, customerName: "Mads" });
      expect(withOld.status).toBe(401);

      const withNew = await request(app)
        .post(`/api/bars/${barId}/guest-token-login`)
        .send({ token: tokenOf(after.body.url), customerName: "Mads" });
      expect(withNew.status).toBe(200);
    });

    // It is the one thing here that would let a stranger in.
    it("never sends the token out with a bar", async () => {
      await request(app).post(`/api/bars/${barId}/rotate-guest-link`);

      const one = await request(app).get(`/api/bars/${barId}`);
      const list = await request(app).get("/api/bars");
      const saved = await setBar({ name: "Somewhere Else" });

      expect(one.body).not.toHaveProperty("guest_token");
      expect(list.body[0]).not.toHaveProperty("guest_token");
      expect(saved.body).not.toHaveProperty("guest_token");
    });
  });
});
