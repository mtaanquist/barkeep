import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

import { openDatabase } from "../src/db/index.js";
import { createApp } from "../src/app.js";

const tempDirs = [];

/** A scratch folder that gets cleaned up after the test file finishes. */
export function makeTempDir(prefix = "home-bar-test-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

export function cleanUpTempDirs() {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
}

/** A fresh, fully migrated database in its own folder. */
export function makeTestDatabase() {
  const dir = makeTempDir();
  return openDatabase(path.join(dir, "bar.db"));
}

/** A database with no tables at all, for testing the migration steps. */
export function makeEmptyDatabase() {
  const dir = makeTempDir();
  const db = new Database(path.join(dir, "bar.db"));
  db.pragma("foreign_keys = ON");
  return db;
}

/** The app, wired to a throwaway database and uploads folder. */
export function makeTestApp() {
  const db = makeTestDatabase();
  const uploadsDir = makeTempDir("home-bar-uploads-");
  // Pointed at a folder with no web pages in it, so the tests only ever see
  // the API and never the single-page-app catch-all.
  const frontendDir = makeTempDir("home-bar-frontend-");

  return { app: createApp({ db, uploadsDir, frontendDir }), db, uploadsDir };
}

/** A bar with one drink, since most things need something to order. */
export function seedBar(db, { name = "Test Bar" } = {}) {
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
