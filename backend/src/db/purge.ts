import { SOFT_DELETE_RETENTION_DAYS } from "../config.js";
import { run, type Db } from "./queries.js";

/**
 * Removes bars the operator retired more than the retention window ago, for
 * good — everything under a bar goes with it through the foreign keys. Returns
 * how many were cleared. `now` is taken as an argument so a test can place it.
 */
export function purgeSoftDeleted(
  db: Db,
  now: number = Date.now(),
  retentionDays: number = SOFT_DELETE_RETENTION_DAYS
): number {
  const days = Math.max(0, Math.floor(retentionDays));
  const nowIso = new Date(now).toISOString();

  // SQLite works out the cutoff so it comes back in the same text format the
  // stored `deleted_at` uses, which is what makes the comparison sound.
  const { changes } = run(
    db,
    `DELETE FROM bars
     WHERE deleted_at IS NOT NULL
       AND deleted_at < datetime(?, ?)`,
    nowIso,
    `-${days} days`
  );

  return changes;
}
