import fs from "fs";

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
