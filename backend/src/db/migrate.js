import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_FILE = path.join(__dirname, "schema.sql");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const announce = (message) => {
  if (process.env.NODE_ENV !== "test") console.log(message);
};

/**
 * Brings the database up to date. Runs on every start; does nothing if there
 * is nothing new to apply.
 */
export function runMigrations(db) {
  // Creates the tables only if they are missing.
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

  // Sorted so the date-named files apply oldest first.
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = [];

  for (const file of files) {
    if (isApplied.get(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

    try {
      // All or nothing, so a failure leaves no half-applied change.
      db.transaction(() => {
        db.exec(sql);
        markApplied.run(file);
      })();
    } catch (error) {
      // An older database may already have this change. Record it instead of
      // failing to start.
      if (/duplicate column name/i.test(error.message)) {
        announce(
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

    announce(`Applied migration: ${file}`);
    applied.push(file);
  }

  return applied;
}
