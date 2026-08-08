import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

import { DB_PATH, UPLOADS_DIR } from "../config.js";
import { runMigrations } from "./migrate.js";

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Brought up to date before anything starts using it.
runMigrations(db);

export function closeDatabase() {
  try {
    db.close();
  } catch (error) {
    console.error("Error closing database:", error);
  }
}
