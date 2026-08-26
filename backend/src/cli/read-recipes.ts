import Database from "better-sqlite3";
import { pathToFileURL } from "node:url";

import { DB_PATH } from "../config.js";
import { all, type Db } from "../db/queries.js";
import { ingredientsIn } from "../recipes/ingredients.js";

// Shows what would be read out of the recipes already in a bar, without
// changing anything. Worth running against a copy of the real database before
// upgrading, since a recipe written in an unusual way may come out wrong and
// this is the only way to see that coming.

const USAGE = `Show what ingredients would be read out of the existing recipes.

  npm run read-recipes
  npm run read-recipes -- --bar <id>

Changes nothing. Run it against a copy of the real database before upgrading,
to see what the upgrade would make of the recipes that are already there.`;

interface Request {
  barId: number | null;
}

/** Reads the request out of the command line. */
export function parseReadArgs(argv: string[]): Request | { help: true } {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };

  const barAt = argv.indexOf("--bar");
  if (barAt === -1) return { barId: null };

  const barId = Number(argv[barAt + 1]);

  if (!Number.isInteger(barId) || barId <= 0) {
    throw new Error("Which bar? Pass --bar <id> with a whole number.");
  }

  return { barId };
}

interface DrinkRow {
  id: number;
  bar_id: number;
  title: string;
  recipe: string | null;
}

/** Prints what each drink's recipe would give, and a count at the end. */
export function reportOn(db: Db, barId: number | null): void {
  const drinks = barId
    ? all<DrinkRow>(
        db,
        "SELECT id, bar_id, title, recipe FROM drinks WHERE bar_id = ? ORDER BY title",
        barId
      )
    : all<DrinkRow>(
        db,
        "SELECT id, bar_id, title, recipe FROM drinks ORDER BY bar_id, title"
      );

  let understood = 0;
  const names = new Set<string>();

  for (const drink of drinks) {
    const found = ingredientsIn(drink.recipe);

    console.log(`\n${drink.title}  (bar ${drink.bar_id}, drink ${drink.id})`);

    if (found.length === 0) {
      console.log("    nothing — this one has to be filled in by hand");
      continue;
    }

    understood += 1;

    for (const { name, amount } of found) {
      names.add(`${drink.bar_id}:${name.toLocaleLowerCase()}`);
      console.log(`    ${(amount ?? "").padEnd(12)}${name}`);
    }
  }

  console.log(
    `\n${understood} of ${drinks.length} recipe(s) understood, ` +
      `${names.size} ingredient(s) in all.`
  );
  console.log("Nothing was changed.\n");
}

function main(): void {
  const parsed = parseReadArgs(process.argv.slice(2));

  if ("help" in parsed) {
    console.log(USAGE);
    return;
  }

  // Opened read-only and without the usual bringing-up-to-date, so running
  // this against a real database cannot change it even by accident.
  const db = new Database(DB_PATH, { readonly: true });

  try {
    reportOn(db, parsed.barId);
  } finally {
    db.close();
  }
}

// Only run when this file is the program, so a test can import the pieces
// without opening a database.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Run with --help for usage.");
    process.exitCode = 1;
  }
}
