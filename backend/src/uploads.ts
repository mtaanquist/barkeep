import fs from "fs";
import path from "path";

import { all } from "./db/queries.js";
import type { Db } from "./db/queries.js";
import { shrinkToFit } from "./images.js";

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
 * Shrinks any photo already on disk that is bigger than we show it. Names
 * the ones it changed.
 *
 * Photos were kept at whatever size the camera gave them until now, so a bar
 * that has been running a while has a folder full of them. This catches those
 * up on the next start; new ones are shrunk as they arrive. Safe to run again
 * — a photo already small enough is left alone, so the second run does
 * nothing.
 *
 * One bad file does not stop the rest: a photo that cannot be read is left as
 * it is and noted.
 */
export async function shrinkStoredPhotos({
  uploadsDir,
}: {
  uploadsDir: string;
}): Promise<string[]> {
  if (!fs.existsSync(uploadsDir)) return [];

  const shrunk: string[] = [];

  for (const name of fs.readdirSync(uploadsDir)) {
    const filePath = path.join(uploadsDir, name);

    try {
      if (!fs.statSync(filePath).isFile()) continue;
      if (await shrinkToFit(filePath)) shrunk.push(name);
    } catch (error) {
      console.error(`Could not shrink ${name}:`, error);
    }
  }

  return shrunk;
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
