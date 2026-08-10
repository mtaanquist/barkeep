import bcrypt from "bcrypt";

import type { Regular } from "../../../shared/types.js";
import { HttpError } from "../http.js";
import {
  all,
  findGuestAccount,
  one,
  run,
  type Db,
  type GuestAccountRow,
} from "../db/queries.js";

// Matches the bar-password hashing elsewhere, kept local like those.
const HASH_ROUNDS = 12;

/** The shortest a claimed-name password may be. Light, for a party app. */
export const GUEST_PASSWORD_MIN = 4;

// Tags the pages branch on, so they never have to read our English messages.
// A claimed name and a wrong password are both a 401; these tell them apart.
export const NAME_CLAIMED = "name_claimed";
export const PASSWORD_INCORRECT = "password_incorrect";

/** What a resolved sign-in carries into the session cookie. */
export interface ResolvedGuest {
  /** The name to remember them by. The stored spelling when a name is claimed,
   * so favourites and history stay put whatever case they typed. */
  name: string;
  /** True once they've proved (or just set) a password for the name. */
  authenticated: boolean;
}

/** Treats a blank or missing password as no password at all. */
function supplied(password: string | undefined): string | undefined {
  return password && password.length > 0 ? password : undefined;
}

/**
 * Settles who a guest is before we hand them a session.
 *
 * - Claimed, right password    → a proven regular (their stored name).
 * - Claimed, wrong/no password → turned away (401), so a namesake can't walk in.
 * - Unclaimed, password given  → the name is claimed now, and they're proven.
 * - Unclaimed, no password     → a one-time guest, signed in anonymously. Quick.
 */
export async function resolveGuest(
  db: Db,
  barId: number,
  name: string,
  password: string | undefined
): Promise<ResolvedGuest> {
  const pw = supplied(password);
  const account = findGuestAccount(db, barId, name);

  if (account) {
    // Missing and wrong are the same refusal, but the pages need to tell a
    // "this name is registered, enter its password" prompt from a plain
    // "wrong password", so the two carry different tags.
    if (!pw) throw new HttpError(401, "That name is registered here", NAME_CLAIMED);

    const matches = await bcrypt.compare(pw, account.password_hash);
    if (!matches) throw new HttpError(401, "Wrong password", PASSWORD_INCORRECT);

    return { name: account.name, authenticated: true };
  }

  if (pw) {
    if (pw.length < GUEST_PASSWORD_MIN) {
      throw HttpError.badRequest(
        `Password must be at least ${GUEST_PASSWORD_MIN} characters long`
      );
    }

    const passwordHash = await bcrypt.hash(pw, HASH_ROUNDS);
    try {
      run(
        db,
        "INSERT INTO guest_accounts (bar_id, name, password_hash) VALUES (?, ?, ?)",
        barId,
        name,
        passwordHash
      );
    } catch {
      // Someone claimed the same name between our look-up and this insert.
      // Treat it like any other claimed name — the password they set isn't it.
      throw new HttpError(409, "That name was just claimed", NAME_CLAIMED);
    }

    return { name, authenticated: true };
  }

  return { name, authenticated: false };
}

/**
 * Changes a claimed name's password. The caller has already proved they are the
 * regular whose name this is.
 */
export async function changeGuestPassword(
  db: Db,
  barId: number,
  name: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const account = findGuestAccount(db, barId, name);
  if (!account) throw HttpError.notFound("No account for this name");

  const matches = await bcrypt.compare(currentPassword, account.password_hash);
  if (!matches) throw new HttpError(401, "Wrong password", PASSWORD_INCORRECT);

  if (newPassword.length < GUEST_PASSWORD_MIN) {
    throw HttpError.badRequest(
      `Password must be at least ${GUEST_PASSWORD_MIN} characters long`
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, HASH_ROUNDS);
  run(db, "UPDATE guest_accounts SET password_hash = ? WHERE id = ?", passwordHash, account.id);
}

/** The regulars a bar has, for the bartender's list. No hashes leave here. */
export function listRegulars(db: Db, barId: number): Regular[] {
  return all<Regular>(
    db,
    `SELECT id, name, created_at FROM guest_accounts
     WHERE bar_id = ? ORDER BY name COLLATE NOCASE`,
    barId
  );
}

/**
 * Renames a regular, carrying their name-keyed favourites and past orders over
 * with them so nothing is left behind. For the bartender to fix a name or tell
 * two same-named regulars apart — the guest is told their new name next visit.
 */
export function renameRegular(
  db: Db,
  barId: number,
  accountId: number,
  newName: string
): Regular {
  const account = one<GuestAccountRow>(
    db,
    "SELECT * FROM guest_accounts WHERE id = ? AND bar_id = ?",
    accountId,
    barId
  );
  if (!account) throw HttpError.notFound("No such regular");

  const trimmed = newName.trim();
  if (trimmed.length < 2) {
    throw HttpError.badRequest("Name must be at least 2 characters long");
  }

  // A rename can't land on a name another regular has already claimed. The same
  // account under a different casing is fine, so fixing the case is allowed.
  const clash = findGuestAccount(db, barId, trimmed);
  if (clash && clash.id !== account.id) {
    throw new HttpError(409, "That name is already taken", NAME_CLAIMED);
  }

  const oldName = account.name;

  db.transaction(() => {
    run(db, "UPDATE guest_accounts SET name = ? WHERE id = ?", trimmed, account.id);

    // Favourites carry a per-drink uniqueness, so move what can move and drop
    // any leftover that would duplicate one already under the new name.
    run(
      db,
      `UPDATE OR IGNORE user_favourites SET customer_name = ?
       WHERE bar_id = ? AND customer_name = ? COLLATE NOCASE`,
      trimmed,
      barId,
      oldName
    );
    run(
      db,
      `DELETE FROM user_favourites
       WHERE bar_id = ? AND customer_name = ? COLLATE NOCASE`,
      barId,
      oldName
    );

    run(
      db,
      `UPDATE orders SET customer_name = ?
       WHERE bar_id = ? AND customer_name = ? COLLATE NOCASE`,
      trimmed,
      barId,
      oldName
    );
  })();

  return { id: account.id, name: trimmed, created_at: account.created_at };
}
