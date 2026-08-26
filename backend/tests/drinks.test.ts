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

describe("what a drink is made of", () => {
  let app: Express;
  let db: Db;
  let barId: number;
  let drinkId: number;

  beforeEach(() => {
    ({ app, db } = makeTestApp());
    ({ barId, drinkId } = seedBar(db));
    app.locals.realtime = { announce: vi.fn(), broadcast: vi.fn() };
  });

  const asBartender = () => sessionCookie({ barId, role: "bartender" });
  const asGuest = () => sessionCookie({ barId, role: "guest", name: "Mads" });

  const setIngredients = (
    ingredients: Array<{ name: string; amount?: string }>
  ) =>
    request(app)
      .put(`/api/drinks/${drinkId}`)
      .set("Cookie", asBartender())
      .send({ ingredients });

  const guestMenu = () =>
    request(app).get(`/api/drinks/bar/${barId}/guest/Mads`).set("Cookie", asGuest());

  const bartenderMenu = () =>
    request(app).get(`/api/drinks/bar/${barId}`).set("Cookie", asBartender());

  /** Switches an ingredient off by name, the way the bartender's screen does. */
  const runOutOf = async (name: string) => {
    const list = await request(app)
      .get(`/api/ingredients/bar/${barId}`)
      .set("Cookie", asBartender());

    const found = list.body.find(
      (i: { name: string }) => i.name === name
    ) as { id: number };

    await request(app)
      .patch(`/api/ingredients/${found.id}/stock`)
      .set("Cookie", asBartender());
  };

  it("saves what a drink is made of, and names anything new", async () => {
    const saved = await setIngredients([
      { name: "Campari", amount: "3 cl" },
      { name: "prosecco", amount: "6 cl" },
    ]);

    expect(saved.status).toBe(200);
    expect(saved.body.ingredient_names).toEqual(["Campari", "prosecco"]);
    expect(saved.body.ingredients).toMatchObject([
      { name: "Campari", amount: "3 cl" },
      { name: "prosecco", amount: "6 cl" },
    ]);
  });

  it("replaces the lot rather than adding to them", async () => {
    await setIngredients([{ name: "Campari" }, { name: "gin" }]);

    const saved = await setIngredients([{ name: "gin" }]);

    expect(saved.body.ingredient_names).toEqual(["gin"]);
  });

  it("picks up an ingredient the bar already has, whatever the case", async () => {
    await setIngredients([{ name: "Campari" }]);
    await setIngredients([{ name: "campari" }]);

    const list = await request(app)
      .get(`/api/ingredients/bar/${barId}`)
      .set("Cookie", asBartender());

    expect(list.body).toHaveLength(1);
  });

  // The point of the whole thing.
  it("takes a drink off the menu when something it needs runs out", async () => {
    await setIngredients([{ name: "Campari" }]);

    expect((await guestMenu()).body[0].available).toBe(1);

    await runOutOf("Campari");

    const menu = await guestMenu();
    expect(menu.body[0].available).toBe(0);
    // The bartender's own switch has not moved.
    expect(menu.body[0].in_stock).toBe(1);
  });

  it("tells the bartender which one is missing", async () => {
    await setIngredients([{ name: "Campari" }, { name: "gin" }]);
    await runOutOf("Campari");

    const menu = await bartenderMenu();

    expect(menu.body[0].missing_ingredients).toEqual(["Campari"]);
  });

  it("leaves a drink with no ingredients exactly as it was", async () => {
    const menu = await guestMenu();

    expect(menu.body[0]).toMatchObject({
      in_stock: 1,
      available: 1,
      ingredient_names: [],
    });
  });

  // Names say what a drink is; amounts say how to make it, which is what the
  // recipe switch is there to keep back.
  it("sends a guest the names but never the amounts", async () => {
    await setIngredients([{ name: "Campari", amount: "3 cl" }]);

    const menu = await guestMenu();

    expect(menu.body[0].ingredient_names).toEqual(["Campari"]);
    expect(menu.body[0].ingredients).toBeUndefined();
    expect(menu.body[0].missing_ingredients).toBeUndefined();
  });

  it("sends the names even when the recipe is not shared", async () => {
    await request(app)
      .put(`/api/drinks/${drinkId}`)
      .set("Cookie", asBartender())
      .send({
        showRecipeToGuests: false,
        ingredients: [{ name: "Campari", amount: "3 cl" }],
      });

    const menu = await guestMenu();

    expect(menu.body[0].recipe).toBeNull();
    expect(menu.body[0].ingredient_names).toEqual(["Campari"]);
  });

  it("keeps a drink whose ingredient has run out off the favourites list", async () => {
    await setIngredients([{ name: "Campari" }]);
    await request(app)
      .post(`/api/drinks/bar/${barId}/favourites`)
      .set("Cookie", asGuest())
      .send({ drinkId });

    const before = await request(app)
      .get(`/api/drinks/bar/${barId}/favourites/Mads`)
      .set("Cookie", asGuest());
    expect(before.body).toHaveLength(1);

    await runOutOf("Campari");

    const after = await request(app)
      .get(`/api/drinks/bar/${barId}/favourites/Mads`)
      .set("Cookie", asGuest());
    expect(after.body).toHaveLength(0);
  });

  it("carries ingredients through when a drink is first added", async () => {
    const added = await request(app)
      .post("/api/drinks")
      .set("Cookie", asBartender())
      .send({
        title: "Negroni Sbagliato",
        recipe: "## Fremgangsmåde\n1. Rør med is.",
        ingredients: [{ name: "Campari", amount: "3 cl" }],
      });

    expect(added.status).toBe(201);
    expect(added.body.ingredient_names).toEqual(["Campari"]);
  });

  it("counts only what can actually be made in the figures", async () => {
    await setIngredients([{ name: "Campari" }]);
    await runOutOf("Campari");

    const report = await request(app)
      .get(`/api/drinks/bar/${barId}/analytics`)
      .set("Cookie", asBartender());

    expect(report.body).toMatchObject({ totalDrinks: 1, inStockDrinks: 0 });
  });

  it("still refuses a save that changes nothing at all", async () => {
    const nothing = await request(app)
      .put(`/api/drinks/${drinkId}`)
      .set("Cookie", asBartender())
      .send({});

    expect(nothing.status).toBe(400);
  });
});
