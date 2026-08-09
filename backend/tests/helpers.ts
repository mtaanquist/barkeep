import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import type { Express } from "express";

import { openDatabase } from "../src/db/index.js";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/queries.js";

const tempDirs: string[] = [];

/** A scratch folder that gets cleaned up after the test file finishes. */
export function makeTempDir(prefix = "barkeep-test-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

export function cleanUpTempDirs(): void {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true });
  }
}

/** A fresh, fully migrated database in its own folder. */
export function makeTestDatabase(): Db {
  return openDatabase(path.join(makeTempDir(), "bar.db"));
}

/** A database with no tables at all, for testing the migration steps. */
export function makeEmptyDatabase(): Db {
  const db = new Database(path.join(makeTempDir(), "bar.db"));
  db.pragma("foreign_keys = ON");
  return db;
}

export interface TestApp {
  app: Express;
  db: Db;
  uploadsDir: string;
}

/** The app, wired to a throwaway database and uploads folder. */
export function makeTestApp(): TestApp {
  const db = makeTestDatabase();
  const uploadsDir = makeTempDir("barkeep-uploads-");
  // Pointed at a folder with no web pages in it, so the tests only ever see
  // the API and never the single-page-app catch-all.
  const frontendDir = makeTempDir("barkeep-frontend-");

  return { app: createApp({ db, uploadsDir, frontendDir }), db, uploadsDir };
}

export interface SeededBar {
  barId: number;
  drinkId: number;
}

/** A bar with one drink, since most things need something to order. */
export function seedBar(db: Db, { name = "Test Bar" } = {}): SeededBar {
  const bar = db
    .prepare(
      `INSERT INTO bars (name, bartender_password_hash, guest_password_hash)
       VALUES (?, 'x', 'y')`
    )
    .run(name);
  const barId = Number(bar.lastInsertRowid);

  const drink = db
    .prepare(
      "INSERT INTO drinks (bar_id, title, recipe) VALUES (?, 'Negroni', 'gin, campari, vermouth')"
    )
    .run(barId);

  return { barId, drinkId: Number(drink.lastInsertRowid) };
}
