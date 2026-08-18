import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

import {
  makeTestApp,
  cleanUpTempDirs,
  seedBar,
  sessionCookie,
} from "./helpers.js";
import type { Express } from "express";
import type { Db } from "../src/db/queries.js";

afterAll(cleanUpTempDirs);

/** Stands in for the live-update connections so we can see what was sent. */
function watchUpdates(app: Express) {
  const broadcast = vi.fn();
  app.locals.realtime = { broadcast };
  return broadcast;
}

describe("orders", () => {
  let app: Express;
  let db: Db;
  let barId: number;
  let drinkId: number;
  let sent: ReturnType<typeof watchUpdates>;

  beforeEach(() => {
    ({ app, db } = makeTestApp());
    ({ barId, drinkId } = seedBar(db));
    sent = watchUpdates(app);
  });

  const asBartender = () => sessionCookie({ barId, role: "bartender" });
  const asGuest = (name: string) =>
    sessionCookie({ barId, role: "guest", name });

  // The name on the order now comes from the guest's cookie, not the body, so
  // it's set through the cookie here rather than passed in.
  // The title on an order is the drink's own, taken on the server, so the body
  // only carries the drink id (the name comes from the cookie).
  const placeOrder = (
    overrides: {
      customerName?: string;
      drinkId?: number | undefined;
    } = {}
  ) => {
    const { customerName = "Mads", ...body } = overrides;
    return request(app)
      .post("/api/orders")
      .set("Cookie", asGuest(customerName))
      .send({ drinkId, ...body });
  };

  it("places an order and tells everyone", async () => {
    const res = await placeOrder();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      customer_name: "Mads",
      drink_title: "Negroni",
      status: "new",
    });
    expect(sent).toHaveBeenCalledWith(barId, expect.objectContaining({ type: "new_order" }));
  });

  it("refuses an order with pieces missing", async () => {
    const res = await placeOrder({ drinkId: undefined });

    expect(res.status).toBe(400);
    expect(sent).not.toHaveBeenCalled();
  });

  it("stores the drink's own title, not whatever the client sent", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", asGuest("Mads"))
      .send({ drinkId, drinkTitle: "Free Top-Shelf Whisky" });

    expect(res.status).toBe(201);
    expect(res.body.drink_title).toBe("Negroni");
  });

  it("refuses an order for a drink that is not there", async () => {
    const res = await placeOrder({ drinkId: 9999 });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(sent).not.toHaveBeenCalled();
  });

  it("refuses one past the bar's limit, and says so in terms of the limit", async () => {
    // A bar that allows two at once. The message must not claim there is only
    // ever one, which is what it used to say however high the limit was set.
    db.prepare("UPDATE bars SET max_active_orders = 2 WHERE id = ?").run(barId);

    expect((await placeOrder()).status).toBe(201);
    expect((await placeOrder()).status).toBe(201);

    const third = await placeOrder();
    expect(third.status).toBe(400);
    expect(third.body.error).toMatch(/as many|allows/i);
    expect(third.body.error).not.toMatch(/a pending order/i);
  });

  it("moves an order along and tells everyone", async () => {
    const { body: order } = await placeOrder();
    sent.mockClear();

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set("Cookie", asBartender())
      .send({ status: "accepted" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
    expect(sent).toHaveBeenCalledWith(
      barId,
      expect.objectContaining({ type: "order_status_updated" })
    );
  });

  it("refuses a status that is not a real one", async () => {
    const { body: order } = await placeOrder();

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set("Cookie", asBartender())
      .send({ status: "brewing-coffee" });

    expect(res.status).toBe(400);
  });

  it("cancels an order and tells everyone", async () => {
    const { body: order } = await placeOrder();
    sent.mockClear();

    const res = await request(app)
      .delete(`/api/orders/${order.id}`)
      .set("Cookie", asGuest("Mads"));

    expect(res.status).toBe(200);
    expect(sent).toHaveBeenCalledWith(
      barId,
      expect.objectContaining({ type: "order_deleted" })
    );

    const remaining = await request(app)
      .get(`/api/orders/bar/${barId}`)
      .set("Cookie", asBartender());
    expect(remaining.body).toHaveLength(0);
  });

  it("gives a guest their own order and not someone else's", async () => {
    await placeOrder();
    await placeOrder({ customerName: "Someone Else" });

    const res = await request(app)
      .get(`/api/orders/bar/${barId}/customer/${encodeURIComponent("Mads")}`)
      .set("Cookie", asGuest("Mads"));

    expect(res.status).toBe(200);
    expect(res.body.customer_name).toBe("Mads");
  });

  it("gives nothing back when a guest has no order waiting", async () => {
    const res = await request(app)
      .get(`/api/orders/bar/${barId}/customer/${encodeURIComponent("Nobody")}`)
      .set("Cookie", asGuest("Nobody"));

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  /** Walks an order through accepted → ready → processed. */
  const advanceTo = async (orderId: number, ...statuses: string[]) => {
    for (const status of statuses) {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set("Cookie", asBartender())
        .send({ status });
      expect(res.status).toBe(200);
    }
  };

  it("goes from ordered to accepted to ready to handed over", async () => {
    const { body: order } = await placeOrder();

    await advanceTo(order.id, "accepted", "ready", "processed");

    const stored = db
      .prepare("SELECT status FROM orders WHERE id = ?")
      .get(order.id) as { status: string };
    expect(stored.status).toBe("processed");
  });

  it("will not skip a step", async () => {
    const { body: order } = await placeOrder();

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set("Cookie", asBartender())
      .send({ status: "processed" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot change status/i);
  });

  it("will not reopen a turned-down order", async () => {
    const { body: order } = await placeOrder();
    await advanceTo(order.id, "rejected");

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set("Cookie", asBartender())
      .send({ status: "accepted" });

    expect(res.status).toBe(400);
  });

  it("stops showing an order once it has been handed over", async () => {
    const { body: order } = await placeOrder();
    await advanceTo(order.id, "accepted", "ready", "processed");

    const res = await request(app)
      .get(`/api/orders/bar/${barId}/customer/${encodeURIComponent("Mads")}`)
      .set("Cookie", asGuest("Mads"));

    expect(res.body).toBeNull();
  });

  it("keeps each bar's orders separate", async () => {
    const other = seedBar(db, { name: "Other Bar" });
    await placeOrder();

    // Read the other bar as its own bartender: the order landed in this bar,
    // not that one.
    const res = await request(app)
      .get(`/api/orders/bar/${other.barId}`)
      .set("Cookie", sessionCookie({ barId: other.barId, role: "bartender" }));

    expect(res.body).toHaveLength(0);
  });

  it("survives having no one listening for updates", async () => {
    delete app.locals.realtime;

    const res = await placeOrder();

    expect(res.status).toBe(201);
  });
});

// The bar has a switch for whether guests may see a recipe. The order list
// handed the recipe over regardless, which made that switch a lie — #15 coming
// back by a different door.
describe("what a guest's own orders tell them", () => {
  let app: Express;
  let db: Db;
  let barId: number;
  let drinkId: number;

  beforeEach(() => {
    ({ app, db } = makeTestApp());
    ({ barId, drinkId } = seedBar(db));
  });

  const order = (name: string) =>
    request(app)
      .post("/api/orders")
      .set("Cookie", sessionCookie({ barId, role: "guest", name }))
      .send({ drinkId });

  const ordersAs = (cookie: string) =>
    request(app).get(`/api/orders/bar/${barId}`).set("Cookie", cookie);

  it("keeps the recipe back from the guest who ordered it", async () => {
    await order("Mads");

    const res = await ordersAs(
      sessionCookie({ barId, role: "guest", name: "Mads" })
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].drink_title).toBe("Negroni");
    expect(res.body[0].drink_recipe).toBeNull();
  });

  it("still hands it to the bartender, who has to make the drink", async () => {
    await order("Mads");

    const res = await ordersAs(sessionCookie({ barId, role: "bartender" }));

    expect(res.body[0].drink_recipe).toBe("gin, campari, vermouth");
  });

  // A recipe is read from the menu, where the bar's own setting decides. An
  // order is not the place for it either way, so this does not vary.
  it("keeps it back even from a bar that shows recipes to guests", async () => {
    db.prepare("UPDATE drinks SET show_recipe_to_guests = 1 WHERE id = ?").run(
      drinkId
    );
    await order("Mads");

    const res = await ordersAs(
      sessionCookie({ barId, role: "guest", name: "Mads" })
    );

    expect(res.body[0].drink_recipe).toBeNull();
  });
});
