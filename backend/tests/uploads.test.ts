import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { Express } from "express";
import type { Db } from "../src/db/queries.js";
import request from "supertest";
import fs from "fs";
import path from "path";

import { deletePhotoIfUnused, sweepUnusedPhotos } from "../src/uploads.js";
import { makeTestApp, cleanUpTempDirs, seedBar } from "./helpers.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

afterAll(cleanUpTempDirs);

describe("tidying up photos", () => {
  let app: Express;
  let db: Db;
  let uploadsDir: string;
  let barId: number;

  beforeEach(() => {
    ({ app, db, uploadsDir } = makeTestApp());
    ({ barId } = seedBar(db));
  });

  const photoOnDisk = (name: string) => fs.existsSync(path.join(uploadsDir, name));

  const uploadPhoto = async () => {
    const res = await request(app)
      .post("/api/drinks/upload-image")
      .attach("image", PNG, { filename: "drink.png", contentType: "image/png" });
    return res.body;
  };

  const createDrink = (imageUrl: string, title = "Negroni") =>
    request(app).post("/api/drinks").send({ barId, title, recipe: "gin", imageUrl });

  it("removes the old photo when a drink gets a new one", async () => {
    const first = await uploadPhoto();
    const drink = await createDrink(first.imageUrl);
    const second = await uploadPhoto();

    await request(app)
      .put(`/api/drinks/${drink.body.id}`)
      .send({ barId, imageUrl: second.imageUrl });

    expect(photoOnDisk(first.filename)).toBe(false);
    expect(photoOnDisk(second.filename)).toBe(true);
  });

  it("keeps the photo when a drink is changed but its photo is not", async () => {
    const photo = await uploadPhoto();
    const drink = await createDrink(photo.imageUrl);

    await request(app)
      .put(`/api/drinks/${drink.body.id}`)
      .send({ barId, title: "Renamed", imageUrl: photo.imageUrl });

    expect(photoOnDisk(photo.filename)).toBe(true);
  });

  it("keeps a photo two drinks share", async () => {
    const photo = await uploadPhoto();
    const one = await createDrink(photo.imageUrl, "First");
    await createDrink(photo.imageUrl, "Second");

    await request(app).delete(`/api/drinks/${one.body.id}`).send({ barId });

    expect(photoOnDisk(photo.filename)).toBe(true);
  });

  it("removes the photo when the last drink using it goes", async () => {
    const photo = await uploadPhoto();
    const one = await createDrink(photo.imageUrl, "First");
    const two = await createDrink(photo.imageUrl, "Second");

    await request(app).delete(`/api/drinks/${one.body.id}`).send({ barId });
    await request(app).delete(`/api/drinks/${two.body.id}`).send({ barId });

    expect(photoOnDisk(photo.filename)).toBe(false);
  });

  it("leaves a photo held elsewhere on the web alone", () => {
    const removed = deletePhotoIfUnused(
      { db, uploadsDir },
      "https://example.com/negroni.jpg"
    );

    expect(removed).toBe(false);
  });

  it("will not reach outside the photos folder", () => {
    const outside = path.join(uploadsDir, "..", "important.txt");
    fs.writeFileSync(outside, "keep me");

    deletePhotoIfUnused({ db, uploadsDir }, "/uploads/../important.txt");

    expect(fs.existsSync(outside)).toBe(true);
    fs.rmSync(outside, { force: true });
  });
});

describe("the daily sweep", () => {
  let db: Db;
  let uploadsDir: string;
  let barId: number;

  beforeEach(() => {
    ({ db, uploadsDir, barId } = (() => {
      const t = makeTestApp();
      return { ...t, ...seedBar(t.db) };
    })());
  });

  const writePhoto = (name: string, ageMs = 0): string => {
    const filePath = path.join(uploadsDir, name);
    fs.writeFileSync(filePath, "photo");
    if (ageMs) {
      const when = new Date(Date.now() - ageMs);
      fs.utimesSync(filePath, when, when);
    }
    return filePath;
  };

  it("removes an old photo nothing refers to", () => {
    writePhoto("drink-orphan.png", 48 * 60 * 60 * 1000);

    const removed = sweepUnusedPhotos({ db, uploadsDir });

    expect(removed).toEqual(["drink-orphan.png"]);
    expect(fs.existsSync(path.join(uploadsDir, "drink-orphan.png"))).toBe(false);
  });

  it("leaves a recent photo alone, in case a drink is still being written", () => {
    writePhoto("drink-just-uploaded.png");

    const removed = sweepUnusedPhotos({ db, uploadsDir });

    expect(removed).toEqual([]);
    expect(
      fs.existsSync(path.join(uploadsDir, "drink-just-uploaded.png"))
    ).toBe(true);
  });

  it("leaves photos that drinks are using, however old", () => {
    writePhoto("drink-in-use.png", 90 * 24 * 60 * 60 * 1000);
    db.prepare(
      "INSERT INTO drinks (bar_id, title, recipe, image_url) VALUES (?, 'Old', 'gin', '/uploads/drink-in-use.png')"
    ).run(barId);

    const removed = sweepUnusedPhotos({ db, uploadsDir });

    expect(removed).toEqual([]);
  });

  it("copes with the photos folder not being there yet", () => {
    expect(() =>
      sweepUnusedPhotos({ db, uploadsDir: path.join(uploadsDir, "nope") })
    ).not.toThrow();
  });
});
