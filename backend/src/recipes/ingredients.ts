// Reads the ingredients out of a recipe that was written as plain text, so a
// bar upgrading does not start with an empty cupboard.
//
// It is deliberately shy: a line it cannot read confidently is left out rather
// than guessed at, because a wrong ingredient can take a drink off the menu
// and a missing one only means typing it in.
//
// Two ways of writing a recipe are understood. One has an "Ingredients"
// heading over a list, and every line of that list is taken. The other, which
// is how most recipes in a real bar turned out to be written, has no heading
// at all: a title, a line per ingredient starting with how much, and then the
// steps as a paragraph. Without the heading only lines that start with an
// amount are taken, since that is what tells them apart from the steps.

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
 * "3", "1.5", "1,5", ".25", "½", "3/4", "1½", "1 2/3". The longer shapes come
 * first, or "1/3" would be read as a one with something after it.
 */
const NUMBER =
  "(?:\\d+\\s?(?:[½¼¾⅓⅔]|\\d+[/⁄]\\d+)|\\d+[/⁄]\\d+|\\d+[.,]\\d+|\\.\\d+|\\d+|[½¼¾⅓⅔])";

/** A number, or two with a dash between: "2-3", "5–8". */
const QUANTITY = `${NUMBER}(?:\\s*[-–—]\\s*${NUMBER})?`;

/**
 * The words for how much, in either language. Anything else after a number is
 * taken to be the start of the name, so "20 blueberries" is twenty of them
 * and not a unit called blueberries.
 */
const UNITS = [
  "oz",
  "ounce",
  "ounces",
  "ml",
  "cl",
  "dl",
  "l",
  "g",
  "dash",
  "dashes",
  "drop",
  "drops",
  "dråbe",
  "dråber",
  "stænk",
  "tsp",
  "teaspoon",
  "teaspoons",
  "tsk",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "spsk",
  "barspoon",
  "barspoons",
  "bsp",
  "splash",
  "splashes",
  "pinch",
  "part",
  "parts",
  "cup",
  "cups",
  "shot",
  "shots",
  "scoop",
  "scoops",
  "stk",
  "skive",
  "skiver",
  "slice",
  "slices",
  "wedge",
  "wedges",
  "sprig",
  "sprigs",
  "kvist",
  "kviste",
  "leaf",
  "leaves",
  "blade",
  "piece",
  "pieces",
];

/** A word that sits in front of a unit: "1 heaped barspoon", "1 fat oz". */
const UNIT_PREFIXES = ["heaped", "heaping", "large", "small", "bar", "fat"];

const UNIT = `(?:(?:${UNIT_PREFIXES.join("|")})\\s+)?(?:${UNITS.join("|")})\\.?`;

/**
 * A quantity at the front of a line, with the word for it if there is one,
 * and whatever is left is the name: "3 cl Campari", "1½ oz white rum",
 * "60ml gin", "2 limes". The unit must be a known one, and must end where
 * the word does, so "7 Up" does not read as seven of something.
 */
const LEADING_AMOUNT = new RegExp(
  `^(${QUANTITY})(?:\\s*(${UNIT})(?![\\p{L}]))?\\s*(.*)$`,
  "iu"
);

/**
 * The same amount written again in another unit, which some recipes do:
 * "¾ oz/22.5 ml", "2 oz 60ml", "60ml / 2oz". Dropped from the name.
 */
const CONVERSION = new RegExp(
  `^(?:/\\s*${QUANTITY}(?:\\s*${UNIT}(?![\\p{L}]))?` +
    `|(?:-or-|or|eller)?\\s*${QUANTITY}\\s*${UNIT}(?![\\p{L}]))\\s*`,
  "iu"
);

/** Longer than this and it is a sentence, not something you pour. */
const TOO_LONG_TO_BE_AN_INGREDIENT = 60;

/**
 * Two sentences on one line means prose crept into the list. A full stop
 * only counts after a whole word, so "St. Germain" and "1 oz. Gin" do not.
 */
const READS_AS_PROSE = /\p{L}{4,}[.!?]\s+\p{Lu}/u;

/** Takes the Markdown off a line, leaving the words. */
function plainly(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Takes the notes off a line: "(or rye, if preferred)", " – jeg brugte
 * Bacardi". Done before anything is judged, so a note does not make a short
 * line look like a sentence.
 */
function withoutNotes(line: string): string {
  return line
    .replace(/\([^)]*\)?/g, " ")
    .replace(/\s+[-–—]\s+.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Takes what is left of the notes off a name, leaving the thing itself:
 * ", freshly squeezed", "Garnish: ", " for garnish", "optional". "Fresh" goes
 * too, so fresh lime juice and lime juice count as one thing to run out of.
 */
function tidyName(name: string): string {
  return name
    .replace(/^[\s.,;:/]+/, "")
    .replace(/,.*$/, "")
    .replace(/^(?:of|af|a|an)\s+/i, "")
    .replace(/^(?:garnish|pynt)\s*[:;]\s*/i, "")
    .replace(/^(?:fresh|freshly\s+\p{L}+|frisk|friskpresset)\s+/iu, "")
    .replace(/\s+(?:(?:for|as)\s+)?garnish$/i, "")
    .replace(/\s+(?:optional|valgfri)$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.,;:]+$/, "")
    .trim();
}

/** Splits "3 cl Campari" into how much and what. */
function readLine(text: string): ReadIngredient | null {
  const line = withoutNotes(plainly(text));

  if (!line) return null;
  if (line.length > TOO_LONG_TO_BE_AN_INGREDIENT) return null;
  if (READS_AS_PROSE.test(line)) return null;

  const withAmount = LEADING_AMOUNT.exec(line);

  if (!withAmount) {
    const name = tidyName(line);
    return name ? { name, amount: null } : null;
  }

  const [, quantity = "", unit, rest] = withAmount;
  const name = tidyName((rest ?? "").replace(CONVERSION, ""));

  if (!name) return { name: tidyName(line), amount: null };

  // "7 Up" and "43 Licor" are names that happen to start with a number. A
  // number with no unit after it, followed by one capitalised word, is one of
  // those — where "2 limes" and "½ citron" are an amount and a thing.
  if (!unit && /^\p{Lu}[\p{L}\d]*$/u.test(name)) {
    return { name: tidyName(line), amount: null };
  }

  const amount = unit ? `${quantity} ${unit.replace(/\.$/, "")}` : quantity;

  return { name, amount: amount.replace(/\s+/g, " ") };
}

/** The lines under an ingredients heading, up to the next heading. */
function linesUnderHeading(lines: string[], start: number): string[] {
  const found: string[] = [];

  for (const line of lines.slice(start + 1)) {
    if (HEADING.test(line)) break;

    const item = LIST_ITEM.exec(line);
    if (item) found.push(item[1] ?? "");
  }

  return found;
}

/** The lines of a recipe with no heading, with any list marks taken off. */
function withoutListMarks(lines: string[]): string[] {
  return lines.map((line) => LIST_ITEM.exec(line)?.[1] ?? line);
}

export interface ReadOptions {
  /**
   * The drink's name. A recipe often starts by repeating it, and a name like
   * "69 Shades of Grey" would otherwise read as sixty-nine of something.
   */
  title?: string | null;
}

/**
 * What a recipe says it is made of. Under an ingredients heading, the whole
 * list; without one, only the lines that start with an amount, since that is
 * all that tells an ingredient from a step.
 */
export function ingredientsIn(
  recipe: string | null,
  { title }: ReadOptions = {}
): ReadIngredient[] {
  if (!recipe) return [];

  const lines = recipe.split(/\r?\n/);
  const start = lines.findIndex((line) => INGREDIENTS_HEADING.test(line));

  const hasHeading = start !== -1;
  const isTitle = (line: string): boolean =>
    !!title &&
    withoutNotes(plainly(line)).toLocaleLowerCase() ===
      title.trim().toLocaleLowerCase();

  const candidates = hasHeading
    ? linesUnderHeading(lines, start)
    : withoutListMarks(lines).filter((line) => !isTitle(line));

  const found: ReadIngredient[] = [];
  const already = new Set<string>();

  for (const candidate of candidates) {
    const read = readLine(candidate);
    if (!read) continue;

    // Without a heading, an amount is all that tells an ingredient from a
    // step, so a line without one is left alone.
    if (!hasHeading && read.amount === null) continue;

    // The same thing twice in one list is a slip, not two ingredients.
    const seen = read.name.toLocaleLowerCase();
    if (already.has(seen)) continue;
    already.add(seen);

    found.push(read);
  }

  return found;
}
