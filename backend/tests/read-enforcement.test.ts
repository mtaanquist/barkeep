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

// Reading used to be wide open: with no cookie at all you could pull a bar's
// whole menu with recipes, its order queue with everyone's names, and its
// takings. Each test here should fail against the code from before the reads
// were locked down.
describe("locking down what can be read", () => {
  let app: Express;
  let db: Db;
  let barId: number;
  let drinkId: number;

  beforeEach(() => {
    ({ app, db } = makeTestApp());
    ({ barId, drinkId } = seedBar(db));
    // The order queue reads this, and it's fine to have no one listening.
    app.locals.realtime = { broadcast: () => {} };
  });

  const asBartender = (id = barId) =>
    sessionCookie({ barId: id, role: "bartender" });
  const asGuest = (name = "Mads", id = barId) =>
    sessionCookie({ barId: id, role: "guest", name });

  const placeOrder = (name: string) =>
    request(app)
      .post("/api/orders")
      .set("Cookie", asGuest(name))
      .send({ drinkId, drinkTitle: "Negroni" });

  // The bartender's own views: the full menu with recipes, the queue, the
  // takings, the printable code. None of these should answer a stranger.
  const bartenderReads = () => [
    `/api/bars/${barId}/dashboard`,
    `/api/bars/${barId}/qrcode`,
    `/api/drinks/bar/${barId}`,
    `/api/drinks/bar/${barId}/analytics`,
    `/api/categories/bar/${barId}`,
    `/api/orders/bar/${barId}/pending`,
    `/api/orders/bar/${barId}/analytics`,
  ];

  describe("with no cookie at all", () => {
    it("turns away every bartender-only read", async () => {
      for (const path of bartenderReads()) {
        const res = await request(app).get(path);
        expect(res.status, path).toBe(401);
      }
    });

    it("won't hand out the menu", async () => {
      const res = await request(app).get(`/api/drinks/bar/${barId}/guest`);
      expect(res.status).toBe(401);
    });

    it("won't hand out the order queue", async () => {
      const res = await request(app).get(`/api/orders/bar/${barId}`);
      expect(res.status).toBe(401);
    });
  });

  // The sign-in screen and the QR welcome need these before anyone has a
  // cookie, so they stay open on purpose.
  describe("the bits sign-in needs stay open", () => {
    it("lists the bars to pick from", async () => {
      const res = await request(app).get("/api/bars");
      expect(res.status).toBe(200);
    });

    it("shows a single bar's public details", async () => {
      const res = await request(app).get(`/api/bars/${barId}`);
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("guest_token");
    });
  });

  describe("a guest can't reach the bartender's views", () => {
    it("is turned away from all of them", async () => {
      for (const path of bartenderReads()) {
        const res = await request(app).get(path).set("Cookie", asGuest());
        expect(res.status, path).toBe(403);
      }
    });

    it("but can read the menu", async () => {
      const res = await request(app)
        .get(`/api/drinks/bar/${barId}/guest`)
        .set("Cookie", asGuest());
      expect(res.status).toBe(200);
    });
  });

  describe("a sign-in for one bar can't read another", () => {
    it("stops a bartender reading a bar that isn't theirs", async () => {
      const other = seedBar(db, { name: "Someone Else's Bar" });
      const res = await request(app)
        .get(`/api/orders/bar/${other.barId}/pending`)
        .set("Cookie", asBartender(barId));
      expect(res.status).toBe(403);
    });

    it("stops a guest reading a bar they didn't join", async () => {
      const other = seedBar(db, { name: "Someone Else's Bar" });
      const res = await request(app)
        .get(`/api/drinks/bar/${other.barId}/guest`)
        .set("Cookie", asGuest("Mads", barId));
      expect(res.status).toBe(403);
    });
  });

  describe("a guest can only look up their own name", () => {
    it("reads their own favourites", async () => {
      const res = await request(app)
        .get(`/api/drinks/bar/${barId}/favourites/Mads`)
        .set("Cookie", asGuest("Mads"));
      expect(res.status).toBe(200);
    });

    it("not another guest's favourites", async () => {
      const res = await request(app)
        .get(`/api/drinks/bar/${barId}/favourites/Astrid`)
        .set("Cookie", asGuest("Mads"));
      expect(res.status).toBe(403);
    });

    it("not another guest's waiting order", async () => {
      const res = await request(app)
        .get(`/api/orders/bar/${barId}/customer/Astrid`)
        .set("Cookie", asGuest("Mads"));
      expect(res.status).toBe(403);
    });

    // The bartender is trusted with the whole room, so any name is fine.
    it("but the bartender may look up anyone", async () => {
      const res = await request(app)
        .get(`/api/orders/bar/${barId}/customer/Astrid`)
        .set("Cookie", asBartender());
      expect(res.status).toBe(200);
    });
  });

  describe("the order queue is filtered to who is reading it", () => {
    beforeEach(async () => {
      await placeOrder("Mads");
      await placeOrder("Astrid");
    });

    it("gives a guest only their own orders", async () => {
      const res = await request(app)
        .get(`/api/orders/bar/${barId}`)
        .set("Cookie", asGuest("Mads"));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].customer_name).toBe("Mads");
    });

    it("won't widen to another guest by asking for their name", async () => {
      const res = await request(app)
        .get(`/api/orders/bar/${barId}?customerName=Astrid`)
        .set("Cookie", asGuest("Mads"));

      expect(res.body).toHaveLength(1);
      expect(res.body[0].customer_name).toBe("Mads");
    });

    it("still gives the bartender the whole room", async () => {
      const res = await request(app)
        .get(`/api/orders/bar/${barId}`)
        .set("Cookie", asBartender());

      expect(res.body).toHaveLength(2);
    });
  });
});
