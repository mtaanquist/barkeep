import crypto from "crypto";
import fs from "fs";
import type { Db } from "./queries.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_FILE = path.join(__dirname, "schema.sql");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const announce = (message: string): void => {
  if (process.env.NODE_ENV !== "test") console.log(message);
};

/**
 * A fingerprint of a change file, so an edit to one already applied gets
 * noticed. Line endings are levelled out first, or the same file checked out
 * on another machine could look changed when it is not.
 */
function fingerprint(sql: string): string {
  return crypto
    .createHash("sha256")
    .update(sql.replace(/\r\n/g, "\n"))
    .digest("hex");
}

/**
 * The separate statements in a file, with comments dropped. Fine for the
 * plain statements these files hold; it would need more care for anything
 * with a semicolon inside it, such as a trigger.
 */
function statementsIn(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

const ADDS_A_COLUMN = /^ALTER\s+TABLE\s+\S+\s+ADD\s+(COLUMN\s+)?/i;
const ONLY_IF_MISSING = /\bIF\s+NOT\s+EXISTS\b/i;

/**
 * True when every statement in the file is harmless to run a second time:
 * either it adds a column, which can be skipped if the column is already
 * there, or it says "if not exists" and does nothing.
 */
function safeToRunAgain(sql: string): boolean {
  return statementsIn(sql).every(
    (statement) =>
      ADDS_A_COLUMN.test(statement) || ONLY_IF_MISSING.test(statement)
  );
}

/**
 * Runs the file a statement at a time, stepping over columns the database
 * already has. This is how a database that had changes applied by hand,
 * before anything kept a record, gets caught up.
 */
function runSkippingExistingColumns(db: Db, sql: string): void {
  for (const statement of statementsIn(sql)) {
    try {
      db.exec(statement);
    } catch (error) {
      const isDuplicate =
        error instanceof Error && /duplicate column name/i.test(error.message);

      if (isDuplicate && ADDS_A_COLUMN.test(statement)) continue;
      throw error;
    }
  }
}

/** Older databases recorded a name and nothing else. */
function addChecksumColumn(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(migrations)").all() as {
    name: string;
  }[];

  if (!columns.some((column) => column.name === "checksum")) {
    db.exec("ALTER TABLE migrations ADD COLUMN checksum TEXT");
  }
}

/**
 * Checks what was applied against what is on disk now. Rows from before
 * fingerprints were kept have none, and are left alone.
 */
function checkNothingChanged(db: Db, migrationsDir: string): void {
  const recorded = db
    .prepare("SELECT name, checksum FROM migrations WHERE checksum IS NOT NULL")
    .all() as { name: string; checksum: string }[];

  const edited: string[] = [];

  for (const { name, checksum } of recorded) {
    const file = path.join(migrationsDir, name);

    // A file that has been removed cannot be compared. Worth saying, but not
    // worth refusing to start over.
    if (!fs.existsSync(file)) {
      announce(`Migration ${name} was applied but is no longer in the folder.`);
      continue;
    }

    if (fingerprint(fs.readFileSync(file, "utf8")) !== checksum) {
      edited.push(name);
    }
  }

  if (edited.length > 0) {
    throw new Error(
      `These migrations have already been applied to the database and have ` +
        `since been edited: ${edited.join(", ")}. An edit to a file that has ` +
        `already run is never applied, so the database and the code no longer ` +
        `match. Put the file back as it was and add a new one instead.`
    );
  }
}

/**
 * Fills in fingerprints for migrations that were applied before any were
 * kept, taking the files as they stand today. Nothing can be proved about
 * those either way, but once they are stamped a later edit does get noticed.
 */
function stampOlderRows(db: Db, migrationsDir: string): void {
  const unstamped = db
    .prepare("SELECT name FROM migrations WHERE checksum IS NULL")
    .all() as { name: string }[];

  const stamp = db.prepare("UPDATE migrations SET checksum = ? WHERE name = ?");

  for (const { name } of unstamped) {
    const file = path.join(migrationsDir, name);
    if (!fs.existsSync(file)) continue;

    stamp.run(fingerprint(fs.readFileSync(file, "utf8")), name);
  }
}

export interface MigrateOptions {
  /** Where the .sql files live. Tests point this at a folder of their own. */
  migrationsDir?: string;
}

/**
 * Brings the database up to date. Runs on every start; does nothing if there
 * is nothing new to apply.
 */
export function runMigrations(
  db: Db,
  { migrationsDir = MIGRATIONS_DIR }: MigrateOptions = {}
): string[] {
  // Creates the tables only if they are missing.
  db.exec(fs.readFileSync(SCHEMA_FILE, "utf8"));

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      checksum TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  addChecksumColumn(db);

  if (!fs.existsSync(migrationsDir)) return [];

  checkNothingChanged(db, migrationsDir);
  stampOlderRows(db, migrationsDir);

  const isApplied = db.prepare("SELECT 1 FROM migrations WHERE name = ?");
  const markApplied = db.prepare(
    "INSERT INTO migrations (name, checksum) VALUES (?, ?)"
  );

  // Sorted so the date-named files apply oldest first.
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied: string[] = [];

  for (const file of files) {
    if (isApplied.get(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const checksum = fingerprint(sql);

    try {
      // All or nothing, so a failure leaves no half-applied change.
      db.transaction(() => {
        db.exec(sql);
        markApplied.run(file, checksum);
      })();

      announce(`Applied migration: ${file}`);
    } catch (error) {
      const isDuplicate =
        error instanceof Error && /duplicate column name/i.test(error.message);

      // An older database may already have part of this. Catching it up beats
      // refusing to start, but only where every statement is safe to run
      // again — otherwise a table the file also creates would be skipped.
      if (!isDuplicate || !safeToRunAgain(sql)) {
        throw new Error(
          `Migration ${file} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error }
        );
      }

      db.transaction(() => {
        runSkippingExistingColumns(db, sql);
        markApplied.run(file, checksum);
      })();

      announce(`Migration ${file} was partly there already; applied the rest.`);
    }

    applied.push(file);
  }

  return applied;
}
