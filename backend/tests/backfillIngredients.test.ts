import { describe, it, expect, afterAll, vi } from "vitest";

import {
  backfillIngredients,
  alreadyRead,
} from "../src/db/backfillIngredients.js";
import { runMigrations } from "../src/db/migrate.js";
import { all, run, type Db } from "../src/db/queries.js";
import { openDatabase } from "../src/db/index.js";
import { makeEmptyDatabase, makeTempDir, cleanUpTempDirs } from "./helpers.js";
import path from "path";

afterAll(cleanUpTempDirs);

const NEGRONI = `## Ingredienser
- 3 cl Campari
- 3 cl rød vermouth

## Fremgangsmåde
1. Rør med is.`;

/** A migrated database with a bar, before anything has read its recipes. */
function aBarWithRecipes(recipes: string[]): { db: Db; barId: number } {
  const db = makeEmptyDatabase();
  runMigrations(db);

  const bar = run(
    db,
    `INSERT INTO bars (name, bartender_password_hash, guest_password_hash)
     VALUES ('Test Bar', 'x', 'y')`
  );
  const barId = Number(bar.lastInsertRowid);

  recipes.forEach((recipe, n) => {
    run(
      db,
      "INSERT INTO drinks (bar_id, title, recipe) VALUES (?, ?, ?)",
      barId,
      `Drink ${n + 1}`,
      recipe
    );
  });

  return { db, barId };
}

const ingredientNames = (db: Db): string[] =>
  all<{ name: string }>(db, "SELECT name FROM ingredients ORDER BY name").map(
    (r) => r.name
  );

describe("reading ingredients out of the recipes already there", () => {
  it("fills in what each drink is made of", () => {
    const { db } = aBarWithRecipes([NEGRONI]);

    expect(backfillIngredients(db)).toBe(1);
    expect(ingredientNames(db)).toEqual(["Campari", "rød vermouth"]);

    const lines = all<{ amount: string | null; position: number }>(
      db,
      "SELECT amount, position FROM drink_ingredients ORDER BY position"
    );
    expect(lines).toEqual([
      { amount: "3 cl", position: 0 },
      { amount: "3 cl", position: 1 },
    ]);
  });

  it("shares one ingredient between the drinks that use it", () => {
    const { db } = aBarWithRecipes([NEGRONI, NEGRONI]);

    backfillIngredients(db);

    expect(ingredientNames(db)).toEqual(["Campari", "rød vermouth"]);
    expect(
      all<{ n: number }>(db, "SELECT COUNT(*) AS n FROM drink_ingredients")[0]
    ).toEqual({ n: 4 });
  });

  // The whole point of writing the step down.
  it("does nothing the second time", () => {
    const { db } = aBarWithRecipes([NEGRONI]);

    backfillIngredients(db);
    const before = ingredientNames(db);

    expect(backfillIngredients(db)).toBe(0);
    expect(ingredientNames(db)).toEqual(before);
  });

  it("carries on past a recipe it cannot make anything of", () => {
    const { db } = aBarWithRecipes(["just some words, no heading", NEGRONI]);

    expect(backfillIngredients(db)).toBe(1);
    expect(ingredientNames(db)).toEqual(["Campari", "rød vermouth"]);
  });

  // Otherwise a brand new bar would be searched again on every start forever.
  it("writes the step down even when there was nothing to read", () => {
    const { db } = aBarWithRecipes([]);

    expect(backfillIngredients(db)).toBe(0);
    expect(alreadyRead(db)).toBe(true);
  });

  it("runs on the way up, so an upgrade needs nothing done by hand", () => {
    const dbPath = path.join(makeTempDir(), "bar.db");

    // A bar as it was before ingredients existed.
    const before = openDatabase(dbPath);
    run(
      before,
      `INSERT INTO bars (name, bartender_password_hash, guest_password_hash)
       VALUES ('Test Bar', 'x', 'y')`
    );
    run(
      before,
      "INSERT INTO drinks (bar_id, title, recipe) VALUES (1, 'Negroni', ?)",
      NEGRONI
    );
    run(before, "DELETE FROM setup_steps");
    before.close();

    const after = openDatabase(dbPath);

    expect(ingredientNames(after)).toEqual(["Campari", "rød vermouth"]);
    after.close();
  });

  // A recipe nobody can parse is worth a line in the log, not a bar that will
  // not open on the night.
  it("opens the bar even if reading the recipes goes wrong", async () => {
    const { db } = aBarWithRecipes([NEGRONI]);
    const complained = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { backfillIngredientsQuietly } = await import(
      "../src/db/backfillIngredients.js"
    );

    // Standing in for anything that could go wrong down there.
    const broken = {
      ...db,
      prepare: () => {
        throw new Error("no");
      },
    } as unknown as Db;

    expect(() => backfillIngredientsQuietly(broken)).not.toThrow();
    expect(complained).toHaveBeenCalled();

    complained.mockRestore();
  });
});
