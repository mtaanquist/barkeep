// Reads the ingredients out of every recipe already in the database, once,
// when a bar upgrades to the version that has them. Without it a bar that has
// been running all summer would open the new screen to an empty cupboard.
//
// This is not a migration: the .sql files can only say what shape the database
// is, and reading a recipe takes more than SQL. It runs straight after them and
// writes down that it has, so it never runs twice.

import type { Db } from "./queries.js";
import { all, one, run } from "./queries.js";
import { ingredientsIn } from "../recipes/ingredients.js";

const STEP = "ingredients-from-recipes";

const announce = (message: string): void => {
  if (process.env.NODE_ENV !== "test") console.log(message);
};

interface DrinkRow {
  id: number;
  bar_id: number;
  recipe: string | null;
}

/** True once this has been done, whatever it found when it did. */
export function alreadyRead(db: Db): boolean {
  return !!one<{ name: string }>(
    db,
    "SELECT name FROM setup_steps WHERE name = ?",
    STEP
  );
}

/**
 * Fills in what each drink is made of, from what its recipe says. Returns how
 * many recipes it got something out of, or 0 if there was nothing to do.
 *
 * Safe to call on every start: it does nothing the second time.
 */
export function backfillIngredients(db: Db): number {
  if (alreadyRead(db)) return 0;

  const drinks = all<DrinkRow>(db, "SELECT id, bar_id, recipe FROM drinks");

  let read = 0;

  db.transaction(() => {
    for (const drink of drinks) {
      const found = ingredientsIn(drink.recipe);
      if (found.length === 0) continue;

      let position = 0;

      for (const { name, amount } of found) {
        run(
          db,
          `INSERT INTO ingredients (bar_id, name) VALUES (?, ?)
           ON CONFLICT DO NOTHING`,
          drink.bar_id,
          name
        );

        const ingredient = one<{ id: number }>(
          db,
          "SELECT id FROM ingredients WHERE bar_id = ? AND name = ? COLLATE NOCASE",
          drink.bar_id,
          name
        );

        if (!ingredient) continue;

        run(
          db,
          `INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, position)
           VALUES (?, ?, ?, ?)
           ON CONFLICT DO NOTHING`,
          drink.id,
          ingredient.id,
          amount,
          position
        );

        position += 1;
      }

      read += 1;
    }

    // Written down even when nothing was found, so a bar with no drinks yet is
    // not searched again on every start for the rest of its life.
    run(db, "INSERT INTO setup_steps (name) VALUES (?)", STEP);
  })();

  if (read > 0) announce(`Read the ingredients out of ${read} recipe(s).`);

  return read;
}

/**
 * The same, but never a reason not to open the bar. A recipe nobody can parse
 * is worth a line in the log, not a door that will not unlock.
 */
export function backfillIngredientsQuietly(db: Db): void {
  try {
    backfillIngredients(db);
  } catch (error) {
    console.error(
      "Could not read the ingredients out of the existing recipes. " +
        "The bar is running; the ingredients can be filled in by hand.",
      error
    );
  }
}
