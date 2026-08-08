import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
} from "./helpers.js";

// Smallest valid PNG, so the type check has something real to look at.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

afterAll(cleanUpTempDirs);

describe("qr code addresses", () => {
  let app;
  let barId;

  beforeAll(() => {
    const t = makeTestApp();
    app = t.app;
    ({ barId } = seedBar(t.db));
  });

  it("uses the address the request came in on", async () => {
    const res = await request(app).get(`/api/bars/${barId}/qrcode`);

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/bar\/\d+\?token=/);
  });

  it("follows a reverse proxy that reports the real address", async () => {
    const res = await request(app)
      .get(`/api/bars/${barId}/qrcode`)
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
      .set("X-Forwarded-Proto", "http")
      .set("Host", "somewhere-else.example.com");

    expect(res.body.url).toContain("https://bar.taaken.dk/bar/");
  });

  it("returns a scannable image", async () => {
    const res = await request(app).get(`/api/bars/${barId}/qrcode`);

    expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
  });
});

describe("photo uploads", () => {
  let app;
  let db;
  let uploadsDir;

  beforeAll(() => ({ app, db, uploadsDir } = makeTestApp()));

  it("accepts a photo and serves it back", async () => {
    const upload = await request(app)
      .post("/api/drinks/upload-image")
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
      .attach("image", Buffer.from("just text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/i);
  });

  it("turns away a photo that is too large", async () => {
    const tooBig = Buffer.alloc(6 * 1024 * 1024, 1);

    const res = await request(app)
      .post("/api/drinks/upload-image")
      .attach("image", tooBig, { filename: "huge.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  });

  it("complains when nothing was sent", async () => {
    const res = await request(app).post("/api/drinks/upload-image");

    expect(res.status).toBe(400);
  });

  it("removes the photo when its drink is deleted", async () => {
    const { barId } = seedBar(db, { name: "Deleting Bar" });

    const upload = await request(app)
      .post("/api/drinks/upload-image")
      .attach("image", PNG, { filename: "doomed.png", contentType: "image/png" });

    const created = await request(app).post("/api/drinks").send({
      barId,
      title: "Doomed",
      recipe: "gin",
      imageUrl: upload.body.imageUrl,
    });
    expect(created.status).toBe(201);

    const filePath = path.join(uploadsDir, upload.body.filename);
    expect(fs.existsSync(filePath)).toBe(true);

    const deleted = await request(app)
      .delete(`/api/drinks/${created.body.id}`)
      .send({ barId });

    expect(deleted.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("does not reach outside the photo folder when deleting", async () => {
    const { barId } = seedBar(db, { name: "Traversal Bar" });
    const outside = path.join(uploadsDir, "..", "keep-me.txt");
    fs.writeFileSync(outside, "should survive");

    const created = await request(app).post("/api/drinks").send({
      barId,
      title: "Sneaky",
      recipe: "gin",
      imageUrl: "/uploads/../keep-me.txt",
    });

    await request(app).delete(`/api/drinks/${created.body.id}`).send({ barId });

    expect(fs.existsSync(outside)).toBe(true);
    fs.rmSync(outside, { force: true });
  });
});
