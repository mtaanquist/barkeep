/**
 * Case and accents are not how anyone remembers a name, so neither gets in the
 * way of finding one: "creme de" finds "Crème de Menthe".
 *
 * Danish letters are stood in for the way they are typed on a keyboard that
 * lacks them — "oel" for "øl", "aeble" for "æble". Stripping accents alone
 * would have folded å and left the other two, which is worse than either.
 *
 * This is for finding things, never for deciding two things are the same one.
 * "rom" and "røm" look alike here and are not the same bottle.
 */
const DANISH: Record<string, string> = { "ø": "oe", "æ": "ae" };

export const loosely = (text: string): string =>
  text
    .toLocaleLowerCase()
    .replace(/[øæ]/g, (letter) => DANISH[letter] as string)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
