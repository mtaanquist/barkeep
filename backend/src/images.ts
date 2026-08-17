import fs from "fs";
import path from "path";

import sharp from "sharp";

// The picture types we accept for a drink photo. SVG is left out on purpose:
// it can carry script, and we serve uploads from our own address, so a stored
// SVG would run in a guest's browser. Each type maps to the one extension we
// store it under, so a misleading filename can't choose the extension a file
// is served with.
export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

/** True for a type we are willing to store. The browser's label, checked. */
export function isAllowedImageType(mime: string): mime is AllowedImageType {
  return mime in ALLOWED_IMAGE_TYPES;
}

/** The extension a given accepted type is stored under. */
export function extensionFor(mime: AllowedImageType): string {
  return ALLOWED_IMAGE_TYPES[mime];
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * The real type of a file from its first bytes, or null when it is none of the
 * pictures we accept. The label a browser sends can say anything, so we look at
 * the bytes rather than take its word — script wearing an image name is caught
 * here.
 */
export function sniffImageType(header: Buffer): AllowedImageType | null {
  if (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (header.length >= 8 && header.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png";
  }

  if (header.length >= 6) {
    const start = header.subarray(0, 6).toString("latin1");
    if (start === "GIF87a" || start === "GIF89a") return "image/gif";
  }

  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString("latin1") === "RIFF" &&
    header.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/** The longest side we keep a photo at, and the one format we keep it in. */
const LONGEST_SIDE = 1600;
const STORED_FORMAT = "webp";

/**
 * How many pixels we are willing to open. A picture can be small on disk and
 * enormous once unpacked, which would take the whole bar down with it.
 */
const MOST_PIXELS = 40_000_000;

/**
 * AVIF is reported as "heif", not a mistake: AVIF is one of that family. A
 * handful are on disk from before the accepted types were narrowed, they can
 * no longer be uploaded, and they are all small already.
 */
const LEAVE_ALONE = new Set(["heif"]);

// One photo at a time and nothing kept between them. The catch-up runs over a
// whole folder at once, and libvips will happily hold on to all of it.
sharp.cache(false);
sharp.concurrency(1);

/**
 * Gets a photo ready to be shown: no bigger than we ever show it, in the one
 * format we keep, and without the notes a camera leaves on it. Gives back
 * where it ended up, or null if there was nothing to do.
 *
 * Written beside the original and moved into place, because a picture cannot
 * be read from and written to at once. Changing the format changes the name,
 * and the original is left where it is: whoever called this has to point the
 * drinks at the new one before removing the old one.
 */
export async function preparePhoto(filePath: string): Promise<string | null> {
  const open = { limitInputPixels: MOST_PIXELS };
  const picture = await sharp(filePath, open).metadata();
  const { format, width = 0, height = 0, pages = 1 } = picture;

  // A moving picture would come back as a single frame. Told apart by having
  // more than one, rather than by its type — a still GIF is just a picture,
  // and a moving one can be a WebP.
  if (pages > 1) return null;
  if (format && LEAVE_ALONE.has(format)) return null;

  const tooBig = Math.max(width, height) > LONGEST_SIDE;
  const wrongFormat = format !== STORED_FORMAT;
  // Where the picture was taken is written onto it by the camera, and photos
  // are served to anyone who can reach the bar. Writing it out again drops it.
  const carriesNotes = Boolean(picture.exif ?? picture.xmp ?? picture.iptc);

  if (!tooBig && !wrongFormat && !carriesNotes) return null;

  const directory = path.dirname(filePath);
  const settled = path.join(
    directory,
    `${path.basename(filePath, path.extname(filePath))}.${STORED_FORMAT}`
  );
  const beside = path.join(directory, `.preparing-${path.basename(settled)}`);

  try {
    await sharp(filePath, open)
      .rotate()
      .resize({
        width: LONGEST_SIDE,
        height: LONGEST_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp()
      .toFile(beside);

    // Two photos whose names differ only by their type would otherwise settle
    // on the same name and quietly destroy each other.
    if (settled !== filePath && fs.existsSync(settled)) {
      fs.unlinkSync(beside);
      throw new Error(`${path.basename(settled)} is already taken`);
    }

    fs.renameSync(beside, settled);
    return settled;
  } catch (error) {
    if (fs.existsSync(beside)) fs.unlinkSync(beside);
    throw error;
  }
}

/** Reads just enough of a file on disk to tell what picture, if any, it is. */
export function sniffImageFile(filePath: string): AllowedImageType | null {
  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const read = fs.readSync(fd, header, 0, header.length, 0);
    return sniffImageType(header.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
}
