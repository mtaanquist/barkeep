import { ZipArchive } from "archiver";
import fs from "fs";
import os from "os";
import path from "path";
import type { Response } from "express";

import { one, type Db } from "./db/queries.js";

export interface ExportOptions {
  db: Db;
  uploadsDir: string;
  /** Drink photos are the bulk of the size, so they are asked for. */
  includeUploads: boolean;
}

/** What the copy is called when it lands in a downloads folder. */
export function exportName(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `barkeep-${stamp}.zip`;
}

/** A few lines in the archive saying what it is and when it was taken. */
function describe(
  db: Db,
  uploadsDir: string,
  includeUploads: boolean
): Record<string, unknown> {
  const lastMigration = one<{ name: string }>(
    db,
    "SELECT name FROM migrations ORDER BY name DESC LIMIT 1"
  );
  const counts = one<{ bars: number; orders: number }>(
    db,
    "SELECT (SELECT COUNT(*) FROM bars) AS bars, (SELECT COUNT(*) FROM orders) AS orders"
  );

  return {
    app: "barkeep",
    takenAt: new Date().toISOString(),
    database: "data/bar.db",
    lastMigration: lastMigration?.name ?? null,
    bars: counts?.bars ?? 0,
    orders: counts?.orders ?? 0,
    photos: countPhotos(uploadsDir),
    photosIncluded: includeUploads,
  };
}

function countPhotos(uploadsDir: string): number {
  try {
    return fs
      .readdirSync(uploadsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .length;
  } catch {
    return 0;
  }
}

/**
 * Streams a copy of the bar's data to the browser as one zip file.
 *
 * Only named files go in. The folder holding the database also holds the key
 * that signs sign-in cookies, which must never leave the machine.
 */
export async function streamExport(
  { db, uploadsDir, includeUploads }: ExportOptions,
  res: Response
): Promise<void> {
  const workDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "barkeep-export-")
  );

  try {
    // A plain file copy would miss whatever is still in the write-ahead log,
    // so let SQLite settle it into one file for us.
    const snapshot = path.join(workDir, "bar.db");
    await db.backup(snapshot);

    const manifest = describe(db, uploadsDir, includeUploads);

    // Nothing is sent until the copy worked, so a failure up to here can still
    // be answered with an ordinary error.
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportName()}"`
    );
    // So the pages can read the name back when they come from another address.
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    const archive = new ZipArchive({ zlib: { level: 6 } });

    // Once bytes are flowing there is no way to send an error instead, so a
    // failure here drops the connection rather than finish a broken file.
    const giveUp = (error: unknown): void => {
      if (res.destroyed) return;
      console.error("Export failed:", error);
      res.destroy();
    };
    archive.on("error", giveUp);
    res.on("close", () => {
      if (!res.writableEnded) archive.abort();
    });

    archive.pipe(res);
    archive.append(JSON.stringify(manifest, null, 2), {
      name: "manifest.json",
    });
    archive.file(snapshot, { name: "data/bar.db" });
    if (includeUploads) archive.directory(uploadsDir, "uploads");

    try {
      await archive.finalize();
    } catch (error) {
      giveUp(error);
    }
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}
