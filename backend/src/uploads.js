import fs from "fs";
import path from "path";

const UPLOAD_PREFIX = "/uploads/";

/** True for photos we store ourselves, as opposed to a web address. */
export function isStoredPhoto(imageUrl) {
  return typeof imageUrl === "string" && imageUrl.startsWith(UPLOAD_PREFIX);
}

/**
 * Deletes a photo, unless some other drink is still using it. Only ever
 * touches files inside the photos folder.
 */
export function deletePhotoIfUnused(
  { db, uploadsDir },
  imageUrl,
  { exceptDrinkId = null } = {}
) {
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
 * Removes photos no drink refers to. A photo is uploaded before the drink is
 * saved, so anything recent is left alone in case someone is still filling in
 * the form.
 */
export function sweepUnusedPhotos({
  db,
  uploadsDir,
  minimumAgeMs = 24 * 60 * 60 * 1000,
  now = Date.now(),
}) {
  if (!fs.existsSync(uploadsDir)) return [];

  const inUse = new Set(
    db
      .prepare("SELECT DISTINCT image_url FROM drinks WHERE image_url IS NOT NULL")
      .all()
      .map((row) => row.image_url)
      .filter(isStoredPhoto)
      .map((url) => path.basename(url))
  );

  const removed = [];

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
