import { randomInt } from "node:crypto";
import bcrypt from "bcrypt";

import { one, run, type Db } from "../db/queries.js";

// Setting a lost password back to something known. Kept as a plain function so
// the recovery command can use it today and an operator route could use the
// very same thing later — neither has to know how the other shows the result.

const HASH_ROUNDS = 12;

// No look-alike characters (no i, l, o, 0, 1), so a code read off a screen and
// typed on a phone doesn't trip on which letter it was.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 10;

export type PasswordRole = "bartender" | "guest";

const COLUMN: Record<PasswordRole, string> = {
  bartender: "bartender_password_hash",
  guest: "guest_password_hash",
};

/** A fresh, readable code: random, no look-alikes, shown in two short groups. */
export function generateResetCode(): string {
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    raw += ALPHABET.charAt(randomInt(ALPHABET.length));
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/**
 * Sets a new password for one bar and hands back the plaintext once. Only the
 * hash is stored; the code itself is never written down anywhere, so the caller
 * has to show it there and then. Throws if there is no such bar.
 */
export async function resetBarPassword(
  db: Db,
  barId: number,
  role: PasswordRole
): Promise<{ barName: string; code: string }> {
  const bar = one<{ name: string }>(
    db,
    "SELECT name FROM bars WHERE id = ?",
    barId
  );
  if (!bar) throw new Error(`No bar with id ${barId}.`);

  const code = generateResetCode();
  const hash = await bcrypt.hash(code, HASH_ROUNDS);

  // The column is chosen from a fixed pair by a typed role, never from input.
  run(db, `UPDATE bars SET ${COLUMN[role]} = ? WHERE id = ?`, hash, barId);

  return { barName: bar.name, code };
}
