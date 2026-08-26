import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

import { DB_PATH } from "../config.js";
import type { Db } from "./queries.js";
import { runMigrations } from "./migrate.js";
import { backfillIngredientsQuietly } from "./backfillIngredients.js";

/**
 * Opens a database and brings it up to date. Pass a path to work on a
 * different one, which is how tests keep out of each other's way.
 */
export function openDatabase(dbPath: string = DB_PATH): Db {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  // Once, on the upgrade that introduced ingredients: read them out of the
  // recipes that are already there.
  backfillIngredientsQuietly(db);

  return db;
}

export function closeDatabase(db: Db | undefined): void {
  try {
    db?.close();
  } catch (error) {
    console.error("Error closing database:", error);
  }
}
