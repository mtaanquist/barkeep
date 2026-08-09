import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
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

  describe("last orders at a set time", () => {
    const at = (minutesFromNow: number) =>
      new Date(Date.now() + minutesFromNow * 60_000).toISOString();

    it("keeps taking orders until the time comes round", async () => {
      await setBar({ lastOrdersAt: at(60) });

      expect((await order()).status).toBe(201);
    });

    it("stops once it has passed, without anyone touching the switch", async () => {
      await setBar({ lastOrdersAt: at(-1) });

      const res = await order();
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/stopped taking orders/i);
    });

    // Worked out when the order is placed rather than latched when the time
    // is saved, so nothing has to be running for it to take effect.
    it("closes on its own with nobody touching the bar in between", async () => {
      await setBar({ lastOrdersAt: at(5) });
      expect((await order()).status).toBe(201);

      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 10 * 60_000));

      expect((await order("Astrid")).status).toBe(400);
      vi.useRealTimers();
    });

    it("can be cleared again", async () => {
      await setBar({ lastOrdersAt: at(-1) });
      await setBar({ lastOrdersAt: null });

      expect((await order()).status).toBe(201);
    });

    it("refuses something that is not a time", async () => {
      expect((await setBar({ lastOrdersAt: "half past" })).status).toBe(400);
    });
  });

  // Nobody should have to remember to undo last night before the next party.
  describe("opening up again", () => {
    let ownBarId: number;

    /** A bar made through the API, so its codes really work. */
    beforeEach(async () => {
      const made = await request(app).post("/api/bars").send({
        name: "Hos Astrid",
        bartenderPassword: "letmein",
        guestPassword: "fest",
      });
      ownBarId = made.body.id;

      db.prepare(
        "INSERT INTO drinks (bar_id, title, recipe) VALUES (?, 'Negroni', 'gin')"
      ).run(ownBarId);
    });

    const ownDrinkId = () =>
      (
        db
          .prepare("SELECT id FROM drinks WHERE bar_id = ?")
          .get(ownBarId) as { id: number }
      ).id;

    const setOwnBar = (body: Record<string, unknown>) =>
      request(app).put(`/api/bars/${ownBarId}`).send(body);

    const orderAtOwnBar = () =>
      request(app).post("/api/orders").send({
        barId: ownBarId,
        customerName: "Mads",
        drinkId: ownDrinkId(),
        drinkTitle: "Negroni",
      });

    const signInAsBartender = () =>
      request(app)
        .post("/api/auth/bartender")
        .send({ barId: ownBarId, password: "letmein" });

    it("clears the switch and the time when the bartender arrives", async () => {
      await setOwnBar({
        ordersClosed: true,
        lastOrdersAt: new Date(Date.now() - 60_000).toISOString(),
      });
      expect((await orderAtOwnBar()).status).toBe(400);

      const signedIn = await signInAsBartender();

      expect(signedIn.status).toBe(200);
      expect(signedIn.body.bar).toMatchObject({
        orders_closed: 0,
        last_orders_at: null,
      });
      expect((await orderAtOwnBar()).status).toBe(201);
    });

    it("leaves a bar that was already open alone", async () => {
      const signedIn = await signInAsBartender();

      expect(signedIn.body.bar).toMatchObject({ orders_closed: 0 });
    });

    // A guest turning up is not the bar opening.
    it("does not reopen for a guest signing in", async () => {
      await setOwnBar({ ordersClosed: true });

      const guest = await request(app)
        .post("/api/auth/guest")
        .send({ barId: ownBarId, password: "fest", customerName: "Mads" });

      expect(guest.status).toBe(200);
      expect((await orderAtOwnBar()).status).toBe(400);
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
