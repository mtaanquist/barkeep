import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { Express } from "express";

import {
  makeTempDir,
  makeTestApp,
  makeTestDatabase,
  cleanUpTempDirs,
  seedBar,
  operatorCookie,
} from "./helpers.js";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/queries.js";

afterAll(cleanUpTempDirs);

const PASSWORD = "back-of-house";

/** Asks for the download and reads the zip back out of the reply. */
async function download(
  app: Express,
  { uploads = false } = {}
): Promise<{ status: number; headers: Record<string, string>; zip: AdmZip }> {
  const res = await request(app)
    .get(`/api/operator/export${uploads ? "?uploads=1" : ""}`)
    .set("Cookie", operatorCookie())
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => callback(null, Buffer.concat(chunks)));
    });

  return {
    status: res.status,
    headers: res.headers as Record<string, string>,
    zip: new AdmZip(res.body as Buffer),
  };
}

const namesIn = (zip: AdmZip): string[] =>
  zip.getEntries().map((entry) => entry.entryName);

describe("downloading a copy of the data", () => {
  let app: Express;
  let db: Db;
  let uploadsDir: string;

  beforeEach(() => {
    ({ app, db, uploadsDir } = makeTestApp({ operatorPassword: PASSWORD }));
    seedBar(db, { name: "The Spotted Cow" });
  });

  it("turns away anyone who is not signed in as the operator", async () => {
    const res = await request(app).get("/api/operator/export");

    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it("sends a zip named after the day it was taken", async () => {
    const { status, headers } = await download(app);

    expect(status).toBe(200);
    expect(headers["content-type"]).toBe("application/zip");
    expect(headers["content-disposition"]).toMatch(
      /attachment; filename="barkeep-\d{4}-\d{2}-\d{2}-\d{4}\.zip"/
    );
  });

  it("holds the database and a note about what is in it", async () => {
    const { zip } = await download(app);

    expect(namesIn(zip)).toContain("data/bar.db");

    const manifest = JSON.parse(
      zip.readAsText("manifest.json")
    ) as Record<string, unknown>;
    expect(manifest["app"]).toBe("barkeep");
    expect(manifest["bars"]).toBe(1);
    expect(manifest["photosIncluded"]).toBe(false);
    expect(manifest["lastMigration"]).toBeTruthy();
  });

  it("leaves out the drink photos unless they are asked for", async () => {
    fs.writeFileSync(path.join(uploadsDir, "drink-1-abc.jpg"), "a photo");

    const { zip } = await download(app);

    expect(namesIn(zip).some((name) => name.startsWith("uploads/"))).toBe(false);
  });

  it("puts the drink photos in when they are asked for", async () => {
    fs.writeFileSync(path.join(uploadsDir, "drink-1-abc.jpg"), "a photo");

    const { zip } = await download(app, { uploads: true });

    expect(namesIn(zip)).toContain("uploads/drink-1-abc.jpg");
    expect(zip.readAsText("uploads/drink-1-abc.jpg")).toBe("a photo");
  });

  // The database runs with a write-ahead log, so a plain file copy can be
  // missing the newest rows. This is what catches that.
  it("hands back a database that opens and still has the bars in it", async () => {
    db.prepare(
      "INSERT INTO orders (bar_id, customer_name, drink_id, drink_title) SELECT id, 'Ada', (SELECT id FROM drinks), 'Negroni' FROM bars"
    ).run();

    const { zip } = await download(app);

    const copyDir = makeTempDir("barkeep-copy-");
    fs.writeFileSync(
      path.join(copyDir, "bar.db"),
      zip.getEntry("data/bar.db")?.getData() as Buffer
    );

    const copy = new Database(path.join(copyDir, "bar.db"), { readonly: true });
    const bar = copy
      .prepare("SELECT name FROM bars")
      .get() as { name: string } | undefined;
    const orders = copy.prepare("SELECT COUNT(*) AS n FROM orders").get() as {
      n: number;
    };
    copy.close();

    expect(bar?.name).toBe("The Spotted Cow");
    expect(orders.n).toBe(1);
  });

  // The key that signs sign-in cookies sits in the same folder as the
  // database. Zipping that folder wholesale would send it to whoever asked.
  it("never sends the cookie key that lives beside the database", async () => {
    fs.writeFileSync(
      path.join(path.dirname(db.name), ".session-secret"),
      "the-real-secret"
    );

    const { zip } = await download(app);

    expect(namesIn(zip)).not.toContain("data/.session-secret");
    expect(
      namesIn(zip).some((name) => name.includes("session-secret"))
    ).toBe(false);
  });
});

describe("the note inside the archive", () => {
  /**
   * A bar that is still taking orders while the copy is made. This stands in
   * for one landing in the moment right after SQLite takes its snapshot.
   */
  function dbThatTakesAnOrderMidCopy(db: Db, drinkId: number): Db {
    return {
      prepare: (sql: string) => db.prepare(sql),
      backup: async (destination: string) => {
        const result = await db.backup(destination);
        db.prepare(
          "INSERT INTO orders (bar_id, customer_name, drink_id, drink_title) VALUES ((SELECT id FROM bars), 'Grace', ?, 'Negroni')"
        ).run(drinkId);
        return result;
      },
    } as unknown as Db;
  }

  it("never claims more than the copy actually holds", async () => {
    const db = makeTestDatabase();
    const { drinkId } = seedBar(db);
    db.prepare(
      "INSERT INTO orders (bar_id, customer_name, drink_id, drink_title) VALUES ((SELECT id FROM bars), 'Ada', ?, 'Negroni')"
    ).run(drinkId);

    const app = createApp({
      db: dbThatTakesAnOrderMidCopy(db, drinkId),
      uploadsDir: makeTempDir("barkeep-uploads-"),
      frontendDir: makeTempDir("barkeep-frontend-"),
      operatorPassword: PASSWORD,
    });

    const { zip } = await download(app);

    const claimed = (
      JSON.parse(zip.readAsText("manifest.json")) as { orders: number }
    ).orders;

    const copyDir = makeTempDir("barkeep-copy-");
    fs.writeFileSync(
      path.join(copyDir, "bar.db"),
      zip.getEntry("data/bar.db")?.getData() as Buffer
    );
    const copy = new Database(path.join(copyDir, "bar.db"), { readonly: true });
    const actual = (
      copy.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }
    ).n;
    copy.close();

    // Counting after the copy would say two orders for a file holding one.
    expect(claimed).toBeLessThanOrEqual(actual);
  });
});
