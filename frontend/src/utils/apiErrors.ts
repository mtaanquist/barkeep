import { ApiError } from "./api";
import type { TranslationKeys } from "./translations";

/** What to say for each thing a guest can run into. */
const SAYS: Partial<Record<string, TranslationKeys>> = {
  orders_closed: "errorOrdersClosed",
  drink_out_of_stock: "errorOutOfStock",
  order_limit_reached: "errorOrderLimit",
  not_signed_in: "errorNotSignedIn",
  bar_not_found: "errorBarNotFound",
  drink_not_found: "errorDrinkNotFound",
  name_too_short: "errorNameTooShort",
  no_account_for_name: "errorNoAccount",
  password_incorrect: "errorWrongPassword",
};

/**
 * What went wrong, in the bar's language.
 *
 * The server writes in English, so its own words are never shown to a guest —
 * a Danish bar telling someone "Drink is currently out of stock" is worse than
 * telling them something went wrong. Anything a guest can really run into is
 * tagged and said properly; the rest falls back to the given wording, with the
 * original left in the console for whoever is looking into it.
 */
export function saidPlainly(
  err: unknown,
  t: (key: TranslationKeys) => string,
  fallback: TranslationKeys
): string {
  const said = err instanceof ApiError && err.code ? SAYS[err.code] : undefined;
  if (said) return t(said);

  console.error("Not something we have wording for:", err);
  return t(fallback);
}
