import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { runMigrations } from "../src/db/migrate.js";
import {
  makeEmptyDatabase,
  makeTestDatabase,
  cleanUpTempDirs,
} from "./helpers.js";

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/db/migrations"
);

const allMigrations = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const appliedNames = (db) =>
  db
    .prepare("SELECT name FROM migrations ORDER BY name")
    .all()
    .map((r) => r.name);

const columnsOf = (db, table) =>
  db
    .prepare(`SELECT name FROM pragma_table_info('${table}')`)
    .all()
    .map((r) => r.name);

afterAll(cleanUpTempDirs);

describe("migrations", () => {
  it("builds the whole schema on an empty database", () => {
    const db = makeEmptyDatabase();

    runMigrations(db);

    expect(appliedNames(db)).toEqual(allMigrations);
    for (const table of ["bars", "drinks", "orders", "categories", "user_favourites"]) {
      expect(columnsOf(db, table).length).toBeGreaterThan(0);
    }
  });

  it("does nothing the second time", () => {
    const db = makeEmptyDatabase();
    runMigrations(db);

    const applied = runMigrations(db);

    expect(applied).toEqual([]);
    expect(appliedNames(db)).toEqual(allMigrations);
  });

  it("applies only what is missing, and keeps existing rows", () => {
    const db = makeEmptyDatabase();
    runMigrations(db);

    db.prepare(
      `INSERT INTO bars (name, bartender_password_hash, guest_password_hash)
       VALUES ('Old Bar', 'x', 'y')`
    ).run();
    db.prepare(
      "INSERT INTO drinks (bar_id, title, recipe) VALUES (1, 'Negroni', 'gin')"
    ).run();

    // Wind the record back so the last two look unapplied.
    const rolledBack = allMigrations.slice(-2);
    for (const name of rolledBack) {
      db.prepare("DELETE FROM migrations WHERE name = ?").run(name);
    }

    const applied = runMigrations(db);

    expect(applied).toEqual(rolledBack);
    expect(appliedNames(db)).toEqual(allMigrations);
    expect(db.prepare("SELECT COUNT(*) AS n FROM drinks").get().n).toBe(1);
    expect(db.prepare("SELECT name FROM bars").get().name).toBe("Old Bar");
  });

  it("recovers a database that predates the record of applied changes", () => {
    const db = makeEmptyDatabase();

    // Everything applied by hand, with nothing recorded — how the oldest
    // installs look.
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, "../schema.sql"), "utf8"));
    for (const name of allMigrations) {
      db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"));
    }

    expect(() => runMigrations(db)).not.toThrow();
    expect(appliedNames(db)).toEqual(allMigrations);
  });

  it("applies in date order regardless of how the folder is read", () => {
    const db = makeTestDatabase();

    const order = db.prepare("SELECT name FROM migrations ORDER BY id").all();

    expect(order.map((r) => r.name)).toEqual(allMigrations);
  });

  it("leaves nothing recorded if a change fails", () => {
    const db = makeEmptyDatabase();
    runMigrations(db);
    const before = appliedNames(db);

    expect(() => db.exec("ALTER TABLE drinks ADD COLUMN title TEXT")).toThrow();

    expect(appliedNames(db)).toEqual(before);
  });
});
