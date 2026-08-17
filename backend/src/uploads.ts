import fs from "fs";
import path from "path";

import { all } from "./db/queries.js";
import type { Db } from "./db/queries.js";
import { preparePhoto } from "./images.js";

const UPLOAD_PREFIX = "/uploads/";

/** True for photos we store ourselves, as opposed to a web address. */
export function isStoredPhoto(imageUrl: unknown): imageUrl is string {
  return typeof imageUrl === "string" && imageUrl.startsWith(UPLOAD_PREFIX);
}

interface PhotoStore {
  db: Db;
  uploadsDir: string;
}

/**
 * Deletes a photo, unless some other drink is still using it. Only ever
 * touches files inside the photos folder.
 */
export function deletePhotoIfUnused(
  { db, uploadsDir }: PhotoStore,
  imageUrl: unknown,
  { exceptDrinkId = null }: { exceptDrinkId?: number | null } = {}
): boolean {
  if (!isStoredPhoto(imageUrl)) return false;

  const stillUsed = db
    .prepare(
      `SELECT 1 FROM drinks
       WHERE image_url = ? AND (? IS NULL OR id != ?)
       LIMIT 1`
    )
    .get(imageUrl, exceptDrinkId, exceptDrinkId);

  if (stillUsed) return false;

  const filePath = path.join(uploadsDir, path.basename(imageUrl));
  if (!fs.existsSync(filePath)) return false;

  fs.unlinkSync(filePath);
  return true;
}

/**
 * Brings every photo already on disk up to how we keep them now: no bigger
 * than we show them, and all in the one format. Names the ones it changed.
 *
 * Photos used to be kept at whatever size and format they arrived in, so a
 * bar that has been running a while has a folder full of them. This catches
 * those up on the next start; new ones are prepared as they arrive.
 *
 * Changing the format changes the file's name, so the drinks pointing at it
 * are moved across too — more than one drink can share a photo. The new file
 * is written first, the drinks are pointed at it, and only then is the old
 * one removed, so a crash part way through leaves every drink pointing at a
 * photo that is really there.
 *
 * Safe to run again: a photo already the right size and format is left alone,
 * so a second start does nothing. One bad file does not stop the rest.
 */
export async function prepareStoredPhotos({
  db,
  uploadsDir,
}: PhotoStore): Promise<string[]> {
  if (!fs.existsSync(uploadsDir)) return [];

  const prepared: string[] = [];

  for (const name of fs.readdirSync(uploadsDir)) {
    const filePath = path.join(uploadsDir, name);

    try {
      if (!fs.statSync(filePath).isFile()) continue;

      const settled = await preparePhoto(filePath);
      if (!settled) continue;

      const newName = path.basename(settled);
      if (newName !== name) {
        db.prepare("UPDATE drinks SET image_url = ? WHERE image_url = ?").run(
          `${UPLOAD_PREFIX}${newName}`,
          `${UPLOAD_PREFIX}${name}`
        );
        // Last, so nothing ever points at a photo that has gone.
        fs.unlinkSync(filePath);
      }

      prepared.push(name);
    } catch (error) {
      console.error(`Could not prepare ${name}:`, error);
    }
  }

  return prepared;
}

/**
 * Removes photos no drink refers to. A photo is uploaded before the drink is
 * saved, so anything recent is left alone in case someone is still filling in
 * the form.
 */
export function sweepUnusedPhotos({
  db,
  uploadsDir,
  minimumAgeMs = 24 * 60 * 60 * 1000,
  now = Date.now(),
}: PhotoStore & { minimumAgeMs?: number; now?: number }): string[] {
  if (!fs.existsSync(uploadsDir)) return [];

  const inUse = new Set(
    all<{ image_url: string | null }>(
      db,
      "SELECT DISTINCT image_url FROM drinks WHERE image_url IS NOT NULL"
    )
      .map((row) => row.image_url)
      .filter(isStoredPhoto)
      .map((url) => path.basename(url))
  );

  const removed: string[] = [];

  for (const name of fs.readdirSync(uploadsDir)) {
    if (inUse.has(name)) continue;

    const filePath = path.join(uploadsDir, name);
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) continue;
    if (now - stats.mtimeMs < minimumAgeMs) continue;

    fs.unlinkSync(filePath);
    removed.push(name);
  }

  return removed;
}
