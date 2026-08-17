import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";
import type { Db } from "../src/db/queries.js";
import request from "supertest";
import fs from "fs";
import path from "path";
import sharp from "sharp";

import { createApp } from "../src/app.js";
import {
  makeTestApp,
  makeTestDatabase,
  makeTempDir,
  cleanUpTempDirs,
  seedBar,
  sessionCookie,
} from "./helpers.js";
import { prepareStoredPhotos } from "../src/uploads.js";

/** A bartender cookie; the bar id only matters for drink routes, not uploads. */
const asBartender = (barId = 1) => sessionCookie({ barId, role: "bartender" });

// Smallest valid PNG, so the type check has something real to look at.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

// A picture that isn't: an SVG carrying script. Nothing here should let it in.
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
);

/** How many uploaded photos are sitting in the folder right now. */
const drinkPhotoCount = (uploadsDir: string): number =>
  fs.existsSync(uploadsDir)
    ? fs.readdirSync(uploadsDir).filter((name) => name.startsWith("drink-")).length
    : 0;

afterAll(cleanUpTempDirs);

describe("qr code addresses", () => {
  let app: Express;
  let barId: number;

  beforeAll(() => {
    const t = makeTestApp();
    app = t.app;
    ({ barId } = seedBar(t.db));
  });

  it("uses the address the request came in on", async () => {
    const res = await request(app)
      .get(`/api/bars/${barId}/qrcode`)
      .set("Cookie", asBartender(barId));

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/bar\/\d+\?token=/);
  });

  it("follows a reverse proxy that reports the real address", async () => {
    const res = await request(app)
      .get(`/api/bars/${barId}/qrcode`)
      .set("Cookie", asBartender(barId))
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-For", "10.0.0.5")
      .set("Host", "bar.example.com");

    expect(res.body.url).toBe(
      `https://bar.example.com/bar/${barId}?token=${Buffer.from(
        `${barId}:guest_access`
      ).toString("base64")}`
    );
  });

  it("prefers a configured address over anything in the request", async () => {
    const db = makeTestDatabase();
    const seeded = seedBar(db);
    const configured = createApp({
      db,
      uploadsDir: makeTempDir(),
      frontendDir: makeTempDir(),
      publicUrl: "https://bar.taaken.dk",
    });

    const res = await request(configured)
      .get(`/api/bars/${seeded.barId}/qrcode`)
      .set("Cookie", asBartender(seeded.barId))
      .set("X-Forwarded-Proto", "http")
      .set("Host", "somewhere-else.example.com");

    expect(res.body.url).toContain("https://bar.taaken.dk/bar/");
  });

  it("returns a scannable image", async () => {
    const res = await request(app)
      .get(`/api/bars/${barId}/qrcode`)
      .set("Cookie", asBartender(barId));

    expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
  });
});

describe("photo uploads", () => {
  let app: Express;
  let db: Db;
  let uploadsDir: string;

  beforeAll(() => ({ app, db, uploadsDir } = makeTestApp()));

  it("accepts a photo and serves it back", async () => {
    const upload = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", PNG, { filename: "negroni.png", contentType: "image/png" });

    expect(upload.status).toBe(200);
    expect(upload.body.imageUrl).toMatch(/^\/uploads\/drink-/);
    expect(fs.existsSync(path.join(uploadsDir, upload.body.filename))).toBe(true);

    const fetched = await request(app).get(upload.body.imageUrl);
    expect(fetched.status).toBe(200);
  });

  it("turns away anything that is not a photo", async () => {
    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", Buffer.from("just text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/i);
  });

  it("turns an unsigned upload away before writing anything", async () => {
    const before = drinkPhotoCount(uploadsDir);

    const res = await request(app)
      .post("/api/drinks/upload-image")
      .attach("image", PNG, { filename: "sneaky.png", contentType: "image/png" });

    expect(res.status).toBe(401);
    // The point of the fix: nothing was saved before the request was refused.
    expect(drinkPhotoCount(uploadsDir)).toBe(before);
  });

  it("turns away an SVG even though it calls itself an image", async () => {
    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", SVG, { filename: "x.svg", contentType: "image/svg+xml" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/i);
  });

  it("turns away script wearing a .png name, leaving nothing behind", async () => {
    const before = drinkPhotoCount(uploadsDir);

    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", SVG, { filename: "x.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/i);
    expect(drinkPhotoCount(uploadsDir)).toBe(before);
  });

  it("turns away a photo that is too large", async () => {
    const tooBig = Buffer.alloc(6 * 1024 * 1024, 1);

    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", tooBig, { filename: "huge.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  });

  it("complains when nothing was sent", async () => {
    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender());

    expect(res.status).toBe(400);
  });

  it("removes the photo when its drink is deleted", async () => {
    const { barId } = seedBar(db, { name: "Deleting Bar" });

    const upload = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender(barId))
      .attach("image", PNG, { filename: "doomed.png", contentType: "image/png" });

    const created = await request(app)
      .post("/api/drinks")
      .set("Cookie", asBartender(barId))
      .send({ title: "Doomed", recipe: "gin", imageUrl: upload.body.imageUrl });
    expect(created.status).toBe(201);

    const filePath = path.join(uploadsDir, upload.body.filename);
    expect(fs.existsSync(filePath)).toBe(true);

    const deleted = await request(app)
      .delete(`/api/drinks/${created.body.id}`)
      .set("Cookie", asBartender(barId));

    expect(deleted.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("does not reach outside the photo folder when deleting", async () => {
    const { barId } = seedBar(db, { name: "Traversal Bar" });
    const outside = path.join(uploadsDir, "..", "keep-me.txt");
    fs.writeFileSync(outside, "should survive");

    const created = await request(app)
      .post("/api/drinks")
      .set("Cookie", asBartender(barId))
      .send({ title: "Sneaky", recipe: "gin", imageUrl: "/uploads/../keep-me.txt" });

    await request(app)
      .delete(`/api/drinks/${created.body.id}`)
      .set("Cookie", asBartender(barId));

    expect(fs.existsSync(outside)).toBe(true);
    fs.rmSync(outside, { force: true });
  });
});

// Photos were kept at whatever size the camera gave them. A phone takes them
// around 4000 pixels across, the menu has over a hundred, and every one was
// sent whole — which is what made the bar slow to open.
describe("photos too big for any screen here", () => {
  let app: Express;
  let uploadsDir: string;

  beforeAll(() => ({ app, uploadsDir } = makeTestApp()));

  /** A photograph of the given size, as a camera would hand one over. */
  const photo = (width: number, height: number, orientation?: number) => {
    let image = sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 120, g: 30, b: 40 },
      },
    });

    if (orientation) image = image.withMetadata({ orientation });

    return image.jpeg().toBuffer();
  };

  const sizeOf = async (filename: string) => {
    const { width = 0, height = 0 } = await sharp(
      path.join(uploadsDir, filename)
    ).metadata();
    return { width, height };
  };

  const send = async (body: Buffer, filename: string) => {
    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", body, { filename, contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    return res.body.filename as string;
  };

  it("shrinks one on its way in", async () => {
    const original = await photo(4032, 3024);
    const stored = await send(original, "negroni.jpg");

    expect(await sizeOf(stored)).toEqual({ width: 1600, height: 1200 });
    expect(fs.statSync(path.join(uploadsDir, stored)).size).toBeLessThan(
      original.length
    );
  });

  // A photograph kept as PNG was three quarters of what the folder weighed
  // once everything had been shrunk.
  it("settles one into the one format we keep, whatever arrived", async () => {
    const stored = await send(await photo(800, 600), "small.jpg");

    expect(stored.endsWith(".webp")).toBe(true);
    expect((await sharp(path.join(uploadsDir, stored)).metadata()).format).toBe(
      "webp"
    );
    // The one it arrived as does not linger beside the one we keep.
    expect(fs.existsSync(path.join(uploadsDir, stored.replace(".webp", ".jpg"))))
      .toBe(false);
  });

  it("leaves one alone that is already the right size and format", async () => {
    const original = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#701e28" },
    })
      .webp()
      .toBuffer();

    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", original, {
        filename: "already.webp",
        contentType: "image/webp",
      });
    const stored = res.body.filename as string;

    expect(await sizeOf(stored)).toEqual({ width: 800, height: 600 });
    // Untouched, rather than read and written back out a little worse.
    expect(fs.statSync(path.join(uploadsDir, stored)).size).toBe(
      original.length
    );
  });

  // The turn a photo was taken at is noted beside the picture rather than in
  // it. Drop the note while shrinking and a portrait photo lands on its side.
  it("keeps a photo the right way up", async () => {
    const stored = await send(await photo(4032, 3024, 6), "portrait.jpg");

    // Turned a quarter, so the tall side is now the long one.
    expect(await sizeOf(stored)).toEqual({ width: 1200, height: 1600 });
  });
});

describe("catching up photos already on disk", () => {
  it("prepares them, moves the drinks across, then has nothing left to do", async () => {
    const uploadsDir = makeTempDir();
    const db = makeTestDatabase();
    seedBar(db);

    const big = path.join(uploadsDir, "drink-big.jpg");
    const small = path.join(uploadsDir, "drink-small.jpg");

    const drinkId = Number(
      db
        .prepare(
          `INSERT INTO drinks (bar_id, title, image_url, recipe, in_stock)
           VALUES (1, 'Negroni', '/uploads/drink-big.jpg', 'gin', 1)`
        )
        .run().lastInsertRowid
    );

    await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: "#701e28" },
    })
      .jpeg()
      .toFile(big);
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#701e28" },
    })
      .jpeg()
      .toFile(small);

    const smallBefore = fs.statSync(small).size;

    expect((await prepareStoredPhotos({ db, uploadsDir })).sort()).toEqual([
      "drink-big.jpg",
      "drink-small.jpg",
    ]);

    // The big one shrank; both ended up in the one format, under a new name.
    const settled = path.join(uploadsDir, "drink-big.webp");
    expect((await sharp(settled).metadata()).width).toBe(1600);
    expect(fs.existsSync(big)).toBe(false);
    expect(fs.existsSync(small)).toBe(false);
    expect(smallBefore).toBeGreaterThan(0);

    // The drink moved across with its photo, rather than pointing at a gap.
    expect(
      db.prepare("SELECT image_url FROM drinks WHERE id = ?").get(drinkId)
    ).toEqual({ image_url: "/uploads/drink-big.webp" });

    // Safe to run again: everything now fits, so nothing is touched twice.
    expect(await prepareStoredPhotos({ db, uploadsDir })).toEqual([]);
  });
});

// There was already a test for script wearing a .png name. A real picture of
// a type we do not accept takes a different path: the label passes the filter
// and only the bytes give it away.
describe("a real picture of a type we do not keep", () => {
  let app: Express;
  let uploadsDir: string;
  let avif: Buffer;

  beforeAll(async () => {
    ({ app, uploadsDir } = makeTestApp());
    avif = await sharp({
      create: { width: 40, height: 40, channels: 3, background: "#701e28" },
    })
      .avif()
      .toBuffer();
  });

  it("turns it away when it says what it is", async () => {
    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", avif, { filename: "x.avif", contentType: "image/avif" });

    expect(res.status).toBe(400);
  });

  it("turns it away wearing a .png name, leaving nothing behind", async () => {
    const before = drinkPhotoCount(uploadsDir);

    const res = await request(app)
      .post("/api/drinks/upload-image")
      .set("Cookie", asBartender())
      .attach("image", avif, { filename: "x.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(drinkPhotoCount(uploadsDir)).toBe(before);
  });
});
