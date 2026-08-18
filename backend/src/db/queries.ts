import type DatabaseType from "better-sqlite3";
import type { Bar, Category, Drink, Order } from "../../../shared/types.js";
import { HttpError } from "../http.js";

export type Db = DatabaseType.Database;

/**
 * A bar as stored, including the password hashes. Kept separate from the
 * shared `Bar` so the hashes cannot leave the server by accident.
 */
export interface BarRow extends Bar {
  bartender_password_hash: string;
  guest_password_hash: string;
  /** Empty means the bar still uses the original fixed QR link. */
  guest_token: string | null;
}

/**
 * A claimed guest name for a bar. A regular sets a password to make their name
 * theirs; one-time guests never get a row here.
 */
export interface GuestAccountRow {
  id: number;
  bar_id: number;
  name: string;
  password_hash: string;
  created_at: string;
}

/** The parts of a bar that are safe to send out. */
export function publicBar(bar: BarRow): Bar {
  const {
    bartender_password_hash,
    guest_password_hash,
    guest_token,
    ...rest
  } = bar;
  void bartender_password_hash;
  void guest_password_hash;
  // The token is what a QR code carries. It never goes out with a bar.
  void guest_token;
  return rest;
}

type Params = readonly unknown[];

/** One row, or nothing. */
export function one<T>(db: Db, sql: string, ...params: Params): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

/** Every matching row. */
export function all<T>(db: Db, sql: string, ...params: Params): T[] {
  return db.prepare(sql).all(...params) as T[];
}

/** A change, returning what SQLite reports about it. */
export function run(
  db: Db,
  sql: string,
  ...params: Params
): DatabaseType.RunResult {
  return db.prepare(sql).run(...params);
}

/** A count, for the many `SELECT COUNT(*)` calls. */
export function count(db: Db, sql: string, ...params: Params): number {
  return one<{ n: number }>(db, sql, ...params)?.n ?? 0;
}

// The lookups below were repeated in nearly every route, each with its own
// wording. Sharing them keeps the replies consistent.

export function findBar(db: Db, barId: number): BarRow {
  // A retired bar is gone as far as everything but the operator is concerned:
  // it can't be signed into, ordered from, or looked up. The operator's own
  // routes query the row directly instead of through here.
  const bar = one<BarRow>(
    db,
    "SELECT * FROM bars WHERE id = ? AND deleted_at IS NULL",
    barId
  );
  if (!bar) throw HttpError.notFound("Bar not found", "bar_not_found");
  return bar;
}

/**
 * A claimed name for a bar, matched without regard to case so it lines up with
 * the table's uniqueness. Nothing when the name is still free.
 */
export function findGuestAccount(
  db: Db,
  barId: number,
  name: string
): GuestAccountRow | undefined {
  return one<GuestAccountRow>(
    db,
    "SELECT * FROM guest_accounts WHERE bar_id = ? AND name = ? COLLATE NOCASE",
    barId,
    name
  );
}

export function findDrink(db: Db, drinkId: number, barId: number): Drink {
  const drink = one<Drink>(
    db,
    "SELECT * FROM drinks WHERE id = ? AND bar_id = ?",
    drinkId,
    barId
  );
  if (!drink) throw HttpError.notFound("Drink not found", "drink_not_found");
  return drink;
}

export function findOrder(db: Db, orderId: number, barId: number): Order {
  const order = one<Order>(
    db,
    "SELECT * FROM orders WHERE id = ? AND bar_id = ?",
    orderId,
    barId
  );
  if (!order) throw HttpError.notFound("Order not found");
  return order;
}

export function findCategory(
  db: Db,
  categoryId: number,
  barId: number
): Category {
  const category = one<Category>(
    db,
    "SELECT * FROM categories WHERE id = ? AND bar_id = ?",
    categoryId,
    barId
  );
  if (!category) throw HttpError.notFound("Category not found");
  return category;
}

/**
 * Builds the `SET` half of an update from whichever fields were sent, so
 * routes stop hand-rolling the same pair of arrays.
 */
export function buildUpdate(
  changes: Record<string, unknown>
): { clause: string; values: unknown[] } {
  const entries = Object.entries(changes).filter(
    ([, value]) => value !== undefined
  );

  if (entries.length === 0) {
    throw HttpError.badRequest("No fields to update");
  }

  return {
    clause: entries.map(([column]) => `${column} = ?`).join(", "),
    values: entries.map(([, value]) => value),
  };
}
