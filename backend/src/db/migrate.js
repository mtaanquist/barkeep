import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_FILE = path.join(__dirname, "schema.sql");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

/**
 * Applies the base schema and any migrations the database hasn't seen yet.
 *
 * Safe to run on every boot, and safe to run against databases created by the
 * older standalone `init-db` script: the bookkeeping table and the filenames
 * recorded in it are unchanged, so previously applied migrations are skipped.
 */
export function runMigrations(db) {
  // Every statement in schema.sql is CREATE ... IF NOT EXISTS, so this is a
  // no-op against an existing database.
  db.exec(fs.readFileSync(SCHEMA_FILE, "utf8"));

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  const isApplied = db.prepare("SELECT 1 FROM migrations WHERE name = ?");
  const markApplied = db.prepare("INSERT INTO migrations (name) VALUES (?)");

  // Filenames are date-prefixed, so lexical order is chronological order.
  // readdirSync order is not guaranteed across filesystems, hence the sort.
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = [];

  for (const file of files) {
    if (isApplied.get(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

    try {
      // Apply and record atomically: a failure leaves no partial bookkeeping.
      db.transaction(() => {
        db.exec(sql);
        markApplied.run(file);
      })();
    } catch (error) {
      // A database that predates the migrations table may already carry these
      // columns. CREATE statements in migrations are all IF NOT EXISTS, so the
      // only idempotency gap is ALTER TABLE ADD COLUMN. Treat that as already
      // applied rather than crash-looping on boot.
      if (/duplicate column name/i.test(error.message)) {
        console.warn(
          `Migration ${file} was already present in the schema; recording it as applied.`
        );
        markApplied.run(file);
        applied.push(file);
        continue;
      }
      throw new Error(`Migration ${file} failed: ${error.message}`, {
        cause: error,
      });
    }

    console.log(`Applied migration: ${file}`);
    applied.push(file);
  }

  return applied;
}
