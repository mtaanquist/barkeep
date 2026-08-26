import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
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

/** Stands in for the live-update connections so we can see what was sent. */
function watchUpdates(app: Express) {
  const announce = vi.fn();
  app.locals.realtime = { announce, broadcast: vi.fn() };
  return announce;
}

describe("ingredients", () => {
  let app: Express;
  let db: Db;
  let barId: number;
  let drinkId: number;
  let told: ReturnType<typeof watchUpdates>;

  beforeEach(() => {
    ({ app, db } = makeTestApp());
    ({ barId, drinkId } = seedBar(db));
    told = watchUpdates(app);
  });

  const asBartender = () => sessionCookie({ barId, role: "bartender" });

  const add = (name: string) =>
    request(app).post("/api/ingredients").set("Cookie", asBartender()).send({
      name,
    });

  it("adds one and lists it", async () => {
    const added = await add("Campari");

    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ name: "Campari", in_stock: 1 });

    const list = await request(app)
      .get(`/api/ingredients/bar/${barId}`)
      .set("Cookie", asBartender());

    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: "Campari", used_by: 0 });
  });

  it("will not have the same thing twice under a different case", async () => {
    await add("Campari");

    const again = await add("campari");

    expect(again.status).toBe(400);
  });

  it("renames one", async () => {
    const { body } = await add("Campri");

    const fixed = await request(app)
      .put(`/api/ingredients/${body.id}`)
      .set("Cookie", asBartender())
      .send({ name: "Campari" });

    expect(fixed.status).toBe(200);
    expect(fixed.body.name).toBe("Campari");
  });

  it("switches one off and back on, and tells everyone watching", async () => {
    const { body } = await add("Campari");

    const off = await request(app)
      .patch(`/api/ingredients/${body.id}/stock`)
      .set("Cookie", asBartender());

    expect(off.body.in_stock).toBe(0);
    expect(told).toHaveBeenCalledWith(barId, { type: "menu_changed" });

    const on = await request(app)
      .patch(`/api/ingredients/${body.id}/stock`)
      .set("Cookie", asBartender());

    expect(on.body.in_stock).toBe(1);
  });

  // A bottle in six drinks nobody orders is not the one to go out for, so the
  // shopping list is sorted by what has actually been asked for.
  it("counts how often the drinks that need it have been ordered", async () => {
    await add("Campari");
    await request(app)
      .put(`/api/drinks/${drinkId}`)
      .set("Cookie", asBartender())
      .send({ ingredients: [{ name: "Campari" }] });

    for (const name of ["Mads", "Ada"]) {
      await request(app)
        .post("/api/orders")
        .set("Cookie", sessionCookie({ barId, role: "guest", name }))
        .send({ drinkId });
    }

    const list = await request(app)
      .get(`/api/ingredients/bar/${barId}`)
      .set("Cookie", asBartender());

    expect(list.body[0]).toMatchObject({ name: "Campari", ordered: 2 });
  });

  it("counts nothing for something no drink uses", async () => {
    await add("Absinthe");

    const list = await request(app)
      .get(`/api/ingredients/bar/${barId}`)
      .set("Cookie", asBartender());

    expect(list.body[0]).toMatchObject({ used_by: 0, ordered: 0 });
  });

  it("says how many drinks would go without it", async () => {
    await add("Campari");
    await request(app)
      .put(`/api/drinks/${drinkId}`)
      .set("Cookie", asBartender())
      .send({ ingredients: [{ name: "Campari", amount: "3 cl" }] });

    const list = await request(app)
      .get(`/api/ingredients/bar/${barId}`)
      .set("Cookie", asBartender());

    expect(list.body[0]).toMatchObject({ name: "Campari", used_by: 1 });
  });

  it("refuses to delete one a drink still needs", async () => {
    await add("Campari");
    await request(app)
      .put(`/api/drinks/${drinkId}`)
      .set("Cookie", asBartender())
      .send({ ingredients: [{ name: "Campari" }] });

    const list = await request(app)
      .get(`/api/ingredients/bar/${barId}`)
      .set("Cookie", asBartender());

    const refused = await request(app)
      .delete(`/api/ingredients/${list.body[0].id}`)
      .set("Cookie", asBartender());

    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/1 drink/);
  });

  it("deletes one nothing is using", async () => {
    const { body } = await add("Absinthe");

    const gone = await request(app)
      .delete(`/api/ingredients/${body.id}`)
      .set("Cookie", asBartender());

    expect(gone.status).toBe(200);
  });

  // One bar's cupboard is not another's.
  it("keeps one bar out of another's", async () => {
    const { body } = await add("Campari");
    const other = seedBar(db, { name: "Somewhere Else" });

    const peeking = await request(app)
      .patch(`/api/ingredients/${body.id}/stock`)
      .set("Cookie", sessionCookie({ barId: other.barId, role: "bartender" }));

    expect(peeking.status).toBe(404);
  });

  it("is not something a guest can touch", async () => {
    const guest = sessionCookie({ barId, role: "guest", name: "Mads" });

    const refused = await request(app)
      .post("/api/ingredients")
      .set("Cookie", guest)
      .send({ name: "Campari" });

    expect(refused.status).toBe(403);
  });
});
