import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

import { makeTestApp, cleanUpTempDirs, seedBar } from "./helpers.js";

afterAll(cleanUpTempDirs);

/** Stands in for the live-update connections so we can see what was sent. */
function watchUpdates(app) {
  const broadcast = vi.fn();
  app.locals.wss = { broadcast };
  return broadcast;
}

describe("orders", () => {
  let app;
  let db;
  let barId;
  let drinkId;
  let sent;

  beforeEach(() => {
    ({ app, db } = makeTestApp());
    ({ barId, drinkId } = seedBar(db));
    sent = watchUpdates(app);
  });

  const placeOrder = (overrides = {}) =>
    request(app)
      .post("/api/orders")
      .send({
        barId,
        customerName: "Mads",
        drinkId,
        drinkTitle: "Negroni",
        ...overrides,
      });

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
    const res = await placeOrder({ customerName: undefined });

    expect(res.status).toBe(400);
    expect(sent).not.toHaveBeenCalled();
  });

  it("refuses an order for a drink that is not there", async () => {
    const res = await placeOrder({ drinkId: 9999 });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(sent).not.toHaveBeenCalled();
  });

  it("moves an order along and tells everyone", async () => {
    const { body: order } = await placeOrder();
    sent.mockClear();

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .send({ barId, status: "accepted" });

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
      .send({ barId, status: "brewing-coffee" });

    expect(res.status).toBe(400);
  });

  it("cancels an order and tells everyone", async () => {
    const { body: order } = await placeOrder();
    sent.mockClear();

    const res = await request(app)
      .delete(`/api/orders/${order.id}`)
      .send({ barId, customerName: "Mads" });

    expect(res.status).toBe(200);
    expect(sent).toHaveBeenCalledWith(
      barId,
      expect.objectContaining({ type: "order_deleted" })
    );

    const remaining = await request(app).get(`/api/orders/bar/${barId}`);
    expect(remaining.body).toHaveLength(0);
  });

  it("gives a guest their own order and not someone else's", async () => {
    await placeOrder();
    await placeOrder({ customerName: "Someone Else" });

    const res = await request(app).get(
      `/api/orders/bar/${barId}/customer/${encodeURIComponent("Mads")}`
    );

    expect(res.status).toBe(200);
    expect(res.body.customer_name).toBe("Mads");
  });

  it("gives nothing back when a guest has no order waiting", async () => {
    const res = await request(app).get(
      `/api/orders/bar/${barId}/customer/${encodeURIComponent("Nobody")}`
    );

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  /** Walks an order through accepted → ready → processed. */
  const advanceTo = async (orderId, ...statuses) => {
    for (const status of statuses) {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ barId, status });
      expect(res.status).toBe(200);
    }
  };

  it("goes from ordered to accepted to ready to handed over", async () => {
    const { body: order } = await placeOrder();

    await advanceTo(order.id, "accepted", "ready", "processed");

    const stored = db
      .prepare("SELECT status FROM orders WHERE id = ?")
      .get(order.id);
    expect(stored.status).toBe("processed");
  });

  it("will not skip a step", async () => {
    const { body: order } = await placeOrder();

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .send({ barId, status: "processed" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot change status/i);
  });

  it("will not reopen a turned-down order", async () => {
    const { body: order } = await placeOrder();
    await advanceTo(order.id, "rejected");

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .send({ barId, status: "accepted" });

    expect(res.status).toBe(400);
  });

  it("stops showing an order once it has been handed over", async () => {
    const { body: order } = await placeOrder();
    await advanceTo(order.id, "accepted", "ready", "processed");

    const res = await request(app).get(
      `/api/orders/bar/${barId}/customer/${encodeURIComponent("Mads")}`
    );

    expect(res.body).toBeNull();
  });

  it("keeps each bar's orders separate", async () => {
    const other = seedBar(db, { name: "Other Bar" });
    await placeOrder();

    const res = await request(app).get(`/api/orders/bar/${other.barId}`);

    expect(res.body).toHaveLength(0);
  });

  it("survives having no one listening for updates", async () => {
    delete app.locals.wss;

    const res = await placeOrder();

    expect(res.status).toBe(201);
  });
});
