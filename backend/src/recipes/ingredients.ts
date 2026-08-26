// Reads the ingredients out of a recipe that was written as plain text, so a
// bar upgrading does not start with an empty cupboard.
//
// It is deliberately shy: a line it cannot read confidently is left out rather
// than guessed at, because a wrong ingredient can take a drink off the menu
// and a missing one only means typing it in.

export interface ReadIngredient {
  name: string;
  /** What the recipe said about how much, as written. */
  amount: string | null;
}

/** The heading a list of ingredients sits under, in either language. */
const INGREDIENTS_HEADING = /^\s{0,3}#{1,6}\s*ingredien\w*\s*:?\s*$/i;

/** Any heading at all, which is where the list stops. */
const HEADING = /^\s{0,3}#{1,6}\s/;

/** A line of a list: "- 3 cl Campari", "* Danskvand", "1. Is". */
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;

/**
 * A quantity at the front of a line, with the word for it if there is one:
 * "3 cl", "1,5 dl", "½", "2-3 dashes", "3 skiver". The name is whatever is
 * left, so a line has to have something left to count.
 */
const LEADING_AMOUNT =
  /^((?:\d+(?:[.,]\d+)?|[½¼¾⅓⅔])(?:\s*[-–—/]\s*\d+(?:[.,]\d+)?)?)(\s+[\p{L}.]+)?\s+(.+)$/u;

/** Longer than this and it is a sentence, not something you pour. */
const TOO_LONG_TO_BE_AN_INGREDIENT = 60;

/** Two sentences on one line means prose crept into the list. */
const READS_AS_PROSE = /[.!?]\s+\p{Lu}/u;

/** Takes the Markdown off a line, leaving the words. */
function plainly(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits "3 cl Campari" into how much and what. */
function readLine(text: string): ReadIngredient | null {
  const line = plainly(text);

  if (!line) return null;
  if (line.length > TOO_LONG_TO_BE_AN_INGREDIENT) return null;
  if (READS_AS_PROSE.test(line)) return null;

  const withAmount = LEADING_AMOUNT.exec(line);

  if (!withAmount) return { name: line, amount: null };

  const [, quantity, unit, rest] = withAmount;
  const name = (rest ?? "").trim();

  if (!name) return { name: line, amount: null };

  // "7 Up" and "43 Licor" are names that happen to start with a number. A
  // number with no unit after it, followed by one capitalised word, is one of
  // those — where "2 limes" and "½ citron" are an amount and a thing.
  if (!unit && /^\p{Lu}[\p{L}\d]*$/u.test(name)) {
    return { name: line, amount: null };
  }

  return { name, amount: `${quantity}${unit ?? ""}`.trim() };
}

/**
 * What a recipe says it is made of. Nothing when it has no ingredients
 * heading, since without one there is no telling a list of ingredients from a
 * list of steps.
 */
export function ingredientsIn(recipe: string | null): ReadIngredient[] {
  if (!recipe) return [];

  const lines = recipe.split(/\r?\n/);
  const start = lines.findIndex((line) => INGREDIENTS_HEADING.test(line));

  if (start === -1) return [];

  const found: ReadIngredient[] = [];
  const already = new Set<string>();

  for (const line of lines.slice(start + 1)) {
    if (HEADING.test(line)) break;

    const item = LIST_ITEM.exec(line);
    if (!item) continue;

    const read = readLine(item[1] ?? "");
    if (!read) continue;

    // The same thing twice in one list is a slip, not two ingredients.
    const seen = read.name.toLocaleLowerCase();
    if (already.has(seen)) continue;
    already.add(seen);

    found.push(read);
  }

  return found;
}
