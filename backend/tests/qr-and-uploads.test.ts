import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";
import type { Db } from "../src/db/queries.js";
import request from "supertest";
import fs from "fs";
import path from "path";

import { createApp } from "../src/app.js";
import {
  makeTestApp,
  makeTestDatabase,
  makeTempDir,
  cleanUpTempDirs,
  seedBar,
  sessionCookie,
} from "./helpers.js";

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
