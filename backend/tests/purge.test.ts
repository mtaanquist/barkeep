import { describe, it, expect, afterAll } from "vitest";

import { makeTestDatabase, cleanUpTempDirs } from "./helpers.js";
import { purgeSoftDeleted } from "../src/db/purge.js";
import type { Db } from "../src/db/queries.js";

afterAll(cleanUpTempDirs);

/** A bar retired a given number of days ago. */
function seedRetiredBar(db: Db, name: string, daysAgo: number): number {
  const info = db
    .prepare(
      `INSERT INTO bars (name, bartender_password_hash, guest_password_hash, deleted_at)
       VALUES (?, 'x', 'y', datetime('now', ?))`
    )
    .run(name, `-${daysAgo} days`);
  return Number(info.lastInsertRowid);
}

const exists = (db: Db, id: number): boolean =>
  db.prepare("SELECT 1 FROM bars WHERE id = ?").get(id) !== undefined;

describe("purging retired bars", () => {
  it("removes one past the window and keeps one still inside it", () => {
    const db = makeTestDatabase();
    const old = seedRetiredBar(db, "Long Gone", 61);
    const recent = seedRetiredBar(db, "Just Retired", 59);

    const removed = purgeSoftDeleted(db, Date.now(), 60);

    expect(removed).toBe(1);
    expect(exists(db, old)).toBe(false);
    expect(exists(db, recent)).toBe(true);
  });

  it("never touches a live bar, even with a zero-day window", () => {
    const db = makeTestDatabase();
    const info = db
      .prepare(
        "INSERT INTO bars (name, bartender_password_hash, guest_password_hash) VALUES ('Live','x','y')"
      )
      .run();

    const removed = purgeSoftDeleted(db, Date.now(), 0);

    expect(removed).toBe(0);
    expect(exists(db, Number(info.lastInsertRowid))).toBe(true);
  });

  it("takes everything under a purged bar with it", () => {
    const db = makeTestDatabase();
    const barId = seedRetiredBar(db, "With Drinks", 100);
    db.prepare(
      "INSERT INTO drinks (bar_id, title, recipe) VALUES (?, 'Negroni', 'gin')"
    ).run(barId);

    purgeSoftDeleted(db, Date.now(), 60);

    const drinks = db
      .prepare("SELECT COUNT(*) AS n FROM drinks WHERE bar_id = ?")
      .get(barId) as { n: number };
    expect(drinks.n).toBe(0);
  });
});
