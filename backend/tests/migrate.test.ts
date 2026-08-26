import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { runMigrations } from "../src/db/migrate.js";
import type { Db } from "../src/db/queries.js";
import {
  makeEmptyDatabase,
  makeTestDatabase,
  makeTempDir,
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

const appliedNames = (db: Db): string[] =>
  (db.prepare("SELECT name FROM migrations ORDER BY name").all() as {
    name: string;
  }[]).map((r) => r.name);

const columnsOf = (db: Db, table: string): string[] =>
  (db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as {
    name: string;
  }[]).map((r) => r.name);

afterAll(cleanUpTempDirs);

describe("migrations", () => {
  it("builds the whole schema on an empty database", () => {
    const db = makeEmptyDatabase();

    runMigrations(db);

    expect(appliedNames(db)).toEqual(allMigrations);
    for (const table of [
      "bars",
      "drinks",
      "orders",
      "categories",
      "user_favourites",
      "ingredients",
      "drink_ingredients",
      "setup_steps",
    ]) {
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
    expect(
      (db.prepare("SELECT COUNT(*) AS n FROM drinks").get() as { n: number }).n
    ).toBe(1);
    expect(
      (db.prepare("SELECT name FROM bars").get() as { name: string }).name
    ).toBe("Old Bar");
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

    const order = db
      .prepare("SELECT name FROM migrations ORDER BY id")
      .all() as { name: string }[];

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

// A file that has already run is never run again, so editing one leaves the
// database and the code saying different things with nothing to show for it.
describe("noticing an edited migration", () => {
  /** A folder holding just the migrations a test writes into it. */
  const migrationFolder = (files: Record<string, string>): string => {
    const dir = makeTempDir("barkeep-migrations-");
    for (const [name, sql] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), sql);
    }
    return dir;
  };

  const checksums = (db: Db): Record<string, string | null> =>
    Object.fromEntries(
      (
        db.prepare("SELECT name, checksum FROM migrations").all() as {
          name: string;
          checksum: string | null;
        }[]
      ).map((r) => [r.name, r.checksum])
    );

  it("records a fingerprint with every migration it applies", () => {
    const db = makeEmptyDatabase();

    runMigrations(db);

    const recorded = checksums(db);
    expect(Object.keys(recorded).sort()).toEqual(allMigrations);
    for (const name of allMigrations) {
      expect(recorded[name]).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("refuses to start once an applied migration has been edited", () => {
    const db = makeEmptyDatabase();
    const dir = migrationFolder({
      "2099-01-01-add-thing.sql": "ALTER TABLE drinks ADD COLUMN thing TEXT;",
    });

    runMigrations(db, { migrationsDir: dir });

    fs.writeFileSync(
      path.join(dir, "2099-01-01-add-thing.sql"),
      "ALTER TABLE drinks ADD COLUMN something_else TEXT;"
    );

    expect(() => runMigrations(db, { migrationsDir: dir })).toThrow(
      /2099-01-01-add-thing\.sql/
    );
  });

  it("accepts rows recorded before fingerprints were kept, then watches them", () => {
    const db = makeEmptyDatabase();
    const file = "2099-01-01-add-thing.sql";
    const dir = migrationFolder({
      [file]: "ALTER TABLE drinks ADD COLUMN thing TEXT;",
    });

    // How an existing install looks: applied, with nothing to compare against.
    runMigrations(db, { migrationsDir: dir });
    db.prepare("UPDATE migrations SET checksum = NULL").run();

    fs.writeFileSync(
      path.join(dir, file),
      "ALTER TABLE drinks ADD COLUMN something_else TEXT;"
    );

    // Starts anyway, and takes the file as it stands as the one to keep to.
    expect(() => runMigrations(db, { migrationsDir: dir })).not.toThrow();
    expect(checksums(db)[file]).toMatch(/^[0-9a-f]{64}$/);

    // From here on an edit is caught like any other.
    fs.writeFileSync(path.join(dir, file), "ALTER TABLE drinks ADD COLUMN third TEXT;");

    expect(() => runMigrations(db, { migrationsDir: dir })).toThrow(
      new RegExp(file.replace(/\./g, "\\."))
    );
  });

  it("carries on when an applied migration file has been removed", () => {
    const db = makeEmptyDatabase();
    const dir = migrationFolder({
      "2099-01-01-add-thing.sql": "ALTER TABLE drinks ADD COLUMN thing TEXT;",
    });

    runMigrations(db, { migrationsDir: dir });
    fs.rmSync(path.join(dir, "2099-01-01-add-thing.sql"));

    expect(() => runMigrations(db, { migrationsDir: dir })).not.toThrow();
    expect(appliedNames(db)).toEqual(["2099-01-01-add-thing.sql"]);
  });
});

// The old recovery wrote the whole file off as done the moment one column was
// already there, so anything else in the same file never ran.
describe("catching up a database that was changed by hand", () => {
  const write = (dir: string, name: string, sql: string): void =>
    fs.writeFileSync(path.join(dir, name), sql);

  it("applies the rest of a migration whose column already exists", () => {
    const db = makeEmptyDatabase();
    const dir = makeTempDir("barkeep-migrations-");

    write(
      dir,
      "2099-01-01-mixed.sql",
      `CREATE TABLE IF NOT EXISTS widgets (id INTEGER PRIMARY KEY);
       ALTER TABLE drinks ADD COLUMN widget_id INTEGER;`
    );

    // The column is there but the table is not — someone applied half of it.
    runMigrations(db);
    db.exec("ALTER TABLE drinks ADD COLUMN widget_id INTEGER");

    expect(runMigrations(db, { migrationsDir: dir })).toEqual([
      "2099-01-01-mixed.sql",
    ]);
    expect(columnsOf(db, "widgets")).toEqual(["id"]);
  });

  it("stops rather than skip a migration that cannot be run again safely", () => {
    const db = makeEmptyDatabase();
    const dir = makeTempDir("barkeep-migrations-");

    // No "if not exists", so running this a second time is not harmless.
    write(
      dir,
      "2099-01-02-unsafe.sql",
      `CREATE TABLE gadgets (id INTEGER PRIMARY KEY);
       ALTER TABLE drinks ADD COLUMN gadget_id INTEGER;`
    );

    runMigrations(db);
    db.exec("ALTER TABLE drinks ADD COLUMN gadget_id INTEGER");

    expect(() => runMigrations(db, { migrationsDir: dir })).toThrow(
      /2099-01-02-unsafe\.sql/
    );
    expect(appliedNames(db)).not.toContain("2099-01-02-unsafe.sql");
  });
});
