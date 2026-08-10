import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

import {
  makeTestApp,
  cleanUpTempDirs,
  seedBar,
  sessionCookie,
} from "./helpers.js";
import type { Db } from "../src/db/queries.js";

afterAll(cleanUpTempDirs);

// These are the holes the change was for: an open API where a request with no
// credentials could do anything, and where a guest was whoever they said they
// were. Each test here should fail against the code from before the lock-down.
describe("locking down changes", () => {
  let app: Express;
  let db: Db;
  let barId: number;
  let drinkId: number;

  beforeEach(() => {
    ({ app, db } = makeTestApp());
    ({ barId, drinkId } = seedBar(db));
  });

  const asBartender = (id = barId) =>
    sessionCookie({ barId: id, role: "bartender" });
  const asGuest = (name = "Mads", id = barId) =>
    sessionCookie({ barId: id, role: "guest", name });

  const placeOrder = (name = "Mads") =>
    request(app)
      .post("/api/orders")
      .set("Cookie", asGuest(name))
      .send({ drinkId, drinkTitle: "Negroni" });

  describe("with no cookie at all", () => {
    it("won't change a bar", async () => {
      const res = await request(app)
        .put(`/api/bars/${barId}`)
        .send({ name: "Hijacked" });
      expect(res.status).toBe(401);
    });

    it("won't add a drink", async () => {
      const res = await request(app)
        .post("/api/drinks")
        .send({ title: "Free Pour", recipe: "gin" });
      expect(res.status).toBe(401);
    });

    it("won't place an order", async () => {
      const res = await request(app)
        .post("/api/orders")
        .send({ drinkId, drinkTitle: "Negroni" });
      expect(res.status).toBe(401);
    });

    it("won't watch the live feed", async () => {
      const res = await request(app).get("/api/events");
      expect(res.status).toBe(401);
    });
  });

  describe("as the wrong kind of user", () => {
    it("stops a guest changing the bar", async () => {
      const res = await request(app)
        .put(`/api/bars/${barId}`)
        .set("Cookie", asGuest())
        .send({ name: "Guest Was Here" });
      expect(res.status).toBe(403);
    });

    it("stops a guest moving an order along", async () => {
      const placed = await placeOrder();
      const res = await request(app)
        .patch(`/api/orders/${placed.body.id}/status`)
        .set("Cookie", asGuest())
        .send({ status: "accepted" });
      expect(res.status).toBe(403);
    });

    it("stops a bartender favouriting a drink", async () => {
      const res = await request(app)
        .post(`/api/drinks/bar/${barId}/favourites`)
        .set("Cookie", asBartender())
        .send({ drinkId });
      expect(res.status).toBe(403);
    });
  });

  describe("acting on another bar", () => {
    it("stops a bartender changing a bar that isn't theirs", async () => {
      const other = seedBar(db, { name: "Someone Else's Bar" });
      const res = await request(app)
        .put(`/api/bars/${other.barId}`)
        .set("Cookie", asBartender(barId))
        .send({ name: "Not Yours" });
      expect(res.status).toBe(403);
    });
  });

  describe("the name comes from the cookie, not the request", () => {
    it("places the order as the signed-in guest, ignoring a forged name", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Cookie", asGuest("Mads"))
        .send({ drinkId, drinkTitle: "Negroni", customerName: "Astrid" });

      expect(res.status).toBe(201);
      expect(res.body.customer_name).toBe("Mads");
    });

    it("won't let a guest cancel someone else's order", async () => {
      const placed = await placeOrder("Mads");
      const res = await request(app)
        .delete(`/api/orders/${placed.body.id}`)
        .set("Cookie", asGuest("Astrid"));
      expect(res.status).toBe(403);
    });

    it("still lets the bartender cancel any order", async () => {
      const placed = await placeOrder("Mads");
      const res = await request(app)
        .delete(`/api/orders/${placed.body.id}`)
        .set("Cookie", asBartender());
      expect(res.status).toBe(200);
    });
  });
});
