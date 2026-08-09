import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { runMigrations } from "../src/db/migrate.js";
import {
  makeEmptyDatabase,
  makeTempDir,
  cleanUpTempDirs,
} from "./helpers.js";
import type { Db } from "../src/db/queries.js";

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/db/migrations"
);

const THIS_ONE = "2026-08-09-add-bar-settings.sql";

const columnsOf = (db: Db, table: string): string[] =>
  (
    db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as {
      name: string;
    }[]
  ).map((r) => r.name);

afterAll(cleanUpTempDirs);

describe("the bar settings migration, on a database with a party in it", () => {
  /**
   * A database as it stood the day before this migration was written, with
   * a bar, a drink and an order already in it — an empty one proves much
   * less than a used one.
   */
  const aBarInUse = (): Db => {
    const before = makeTempDir();
    for (const file of fs.readdirSync(MIGRATIONS_DIR)) {
      if (file.endsWith(".sql") && file < THIS_ONE) {
        fs.copyFileSync(
          path.join(MIGRATIONS_DIR, file),
          path.join(before, file)
        );
      }
    }

    const db = makeEmptyDatabase();
    runMigrations(db, { migrationsDir: before });

    expect(columnsOf(db, "bars")).not.toContain("orders_closed");

    db.prepare(
      `INSERT INTO bars (name, bartender_password_hash, guest_password_hash, language)
       VALUES ('Hos Astrid', 'hash-a', 'hash-b', 'da')`
    ).run();
    db.prepare(
      "INSERT INTO drinks (bar_id, title, recipe) VALUES (1, 'Negroni', 'gin')"
    ).run();
    db.prepare(
      `INSERT INTO orders (bar_id, customer_name, drink_id, drink_title, status)
       VALUES (1, 'Mads', 1, 'Negroni', 'ready')`
    ).run();

    return db;
  };

  it("adds the columns without disturbing what is already there", () => {
    const db = aBarInUse();

    const applied = runMigrations(db);
    expect(applied).toContain(THIS_ONE);

    expect(columnsOf(db, "bars")).toEqual(
      expect.arrayContaining([
        "orders_closed",
        "max_active_orders",
        "guest_token",
      ])
    );

    const bar = db.prepare("SELECT * FROM bars WHERE id = 1").get() as Record<
      string,
      unknown
    >;
    expect(bar.name).toBe("Hos Astrid");
    expect(bar.language).toBe("da");
    expect(bar.bartender_password_hash).toBe("hash-a");

    const order = db.prepare("SELECT * FROM orders WHERE id = 1").get() as Record<
      string,
      unknown
    >;
    expect(order.status).toBe("ready");
  });

  // A bar that existed before this ran has to behave exactly as it did.
  it("leaves an existing bar open, one drink at a time, on its old link", () => {
    const db = aBarInUse();

    runMigrations(db);

    const bar = db.prepare("SELECT * FROM bars WHERE id = 1").get() as Record<
      string,
      unknown
    >;

    expect(bar.orders_closed).toBe(0);
    expect(bar.max_active_orders).toBe(1);
    // Empty means the original QR link, so codes already printed still work.
    expect(bar.guest_token).toBeNull();
  });

  it("is safe to start twice", () => {
    const db = aBarInUse();

    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});
