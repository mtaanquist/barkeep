import type {
  DrinkIngredient,
  DrinkWithCategory,
} from "../../../shared/types.js";
import { all, one, run, type Db } from "./queries.js";

/**
 * Whether a drink can be ordered: the bartender's own switch is on, and
 * nothing it is made of has run out. Written once and shared, because several
 * separate queries have to agree on it.
 */
export const AVAILABLE = `
  CASE WHEN d.in_stock = 1 AND NOT EXISTS (
    SELECT 1 FROM drink_ingredients di
    JOIN ingredients i ON i.id = di.ingredient_id
    WHERE di.drink_id = d.id AND i.in_stock = 0
  ) THEN 1 ELSE 0 END AS available
`;

/** The same question about one drink, for the moment an order is placed. */
export function drinkIsAvailable(db: Db, drinkId: number): boolean {
  const answer = one<{ available: number }>(
    db,
    `SELECT ${AVAILABLE} FROM drinks d WHERE d.id = ?`,
    drinkId
  );

  return answer?.available === 1;
}

interface Row extends DrinkIngredient {
  drink_id: number;
}

/** Every drink in a bar and what it is made of, in the recipe's order. */
export function ingredientsByDrink(
  db: Db,
  barId: number
): Map<number, DrinkIngredient[]> {
  const rows = all<Row>(
    db,
    `SELECT di.drink_id, di.ingredient_id, di.amount, i.name, i.in_stock
     FROM drink_ingredients di
     JOIN ingredients i ON i.id = di.ingredient_id
     JOIN drinks d ON d.id = di.drink_id
     WHERE d.bar_id = ?
     ORDER BY di.drink_id, di.position, i.name COLLATE NOCASE`,
    barId
  );

  const byDrink = new Map<number, DrinkIngredient[]>();

  for (const { drink_id, ...ingredient } of rows) {
    const soFar = byDrink.get(drink_id);
    if (soFar) soFar.push(ingredient);
    else byDrink.set(drink_id, [ingredient]);
  }

  return byDrink;
}

/**
 * Fills in what each drink is made of. The names go to anyone — they say what
 * a drink is, not how to make it — but the amounts, and the reason something is
 * off the menu, are the bartender's.
 */
export function withIngredients<T extends DrinkWithCategory>(
  drinks: T[],
  byDrink: Map<number, DrinkIngredient[]>,
  { forBartender }: { forBartender: boolean }
): T[] {
  return drinks.map((drink) => {
    const ingredients = byDrink.get(drink.id) ?? [];
    const names = ingredients.map((i) => i.name);

    if (!forBartender) return { ...drink, ingredient_names: names };

    return {
      ...drink,
      ingredient_names: names,
      ingredients,
      missing_ingredients: ingredients
        .filter((i) => i.in_stock === 0)
        .map((i) => i.name),
    };
  });
}

/** What one drink is made of, for the routes that answer with a single drink. */
export function ingredientsOf(db: Db, drinkId: number): DrinkIngredient[] {
  return all<DrinkIngredient>(
    db,
    `SELECT di.ingredient_id, di.amount, i.name, i.in_stock
     FROM drink_ingredients di
     JOIN ingredients i ON i.id = di.ingredient_id
     WHERE di.drink_id = ?
     ORDER BY di.position, i.name COLLATE NOCASE`,
    drinkId
  );
}

/** What the drink form sends: a name, and what the recipe says about how much. */
export interface IngredientLine {
  name: string;
  amount: string | null;
}

/**
 * Reads the ingredient lines out of a request body, dropping blank ones and
 * anything that is not a line at all. Nothing when none were sent, so a caller
 * that leaves them out leaves them alone.
 */
export function ingredientLinesIn(body: unknown): IngredientLine[] | undefined {
  const sent = (body as Record<string, unknown>)?.["ingredients"];
  if (!Array.isArray(sent)) return undefined;

  const lines: IngredientLine[] = [];

  for (const entry of sent) {
    const asRecord =
      typeof entry === "object" && entry !== null
        ? (entry as Record<string, unknown>)
        : undefined;

    const name = asRecord ? asRecord["name"] : entry;
    if (typeof name !== "string" || !name.trim()) continue;

    const amount = asRecord?.["amount"];

    lines.push({
      name: name.trim(),
      amount:
        typeof amount === "string" && amount.trim() ? amount.trim() : null,
    });
  }

  return lines;
}

/**
 * The bar's ingredient with this name, adding it if the bar has not got one.
 * Names are matched without regard to case, so typing "campari" into the form
 * picks up the Campari already there rather than making a second one.
 */
export function ingredientNamed(db: Db, barId: number, name: string): number {
  const existing = one<{ id: number }>(
    db,
    "SELECT id FROM ingredients WHERE bar_id = ? AND name = ? COLLATE NOCASE",
    barId,
    name
  );

  if (existing) return existing.id;

  const { lastInsertRowid } = run(
    db,
    "INSERT INTO ingredients (bar_id, name) VALUES (?, ?)",
    barId,
    name
  );

  return Number(lastInsertRowid);
}

/**
 * Replaces what a drink is made of, in one go, so a save that drops a line
 * cannot leave half of it behind. A name the bar has not seen becomes a new
 * ingredient, which is how the form lets one be typed rather than picked.
 */
export function setDrinkIngredients(
  db: Db,
  barId: number,
  drinkId: number,
  lines: IngredientLine[]
): void {
  db.transaction(() => {
    run(db, "DELETE FROM drink_ingredients WHERE drink_id = ?", drinkId);

    let position = 0;
    const already = new Set<number>();

    for (const line of lines) {
      const ingredientId = ingredientNamed(db, barId, line.name);

      // The same ingredient twice in one recipe is a slip, not two lines.
      if (already.has(ingredientId)) continue;
      already.add(ingredientId);

      run(
        db,
        `INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, position)
         VALUES (?, ?, ?, ?)`,
        drinkId,
        ingredientId,
        line.amount,
        position
      );

      position += 1;
    }
  })();
}
