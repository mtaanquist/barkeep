// These cover the three routing faults that reached production, all caused by
// handlers being registered in the wrong order.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";
import request from "supertest";
import fs from "fs";
import path from "path";

import { createApp } from "../src/app.js";
import {
  makeTestApp,
  makeTestDatabase,
  makeTempDir,
  cleanUpTempDirs,
} from "./helpers.js";

afterAll(cleanUpTempDirs);

describe("api routing", () => {
  let app: Express;
  beforeAll(() => ({ app } = makeTestApp()));

  it("answers unknown api addresses with an error, not a web page", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
    expect(res.body.error).toBeTruthy();
  });

  it("does the same for unknown addresses under a real section", async () => {
    const res = await request(app).get("/api/drinks/nope/nope");

    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
  });

  it("reports health", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "OK", database: "connected" });
  });

  it("reports unhealthy when the database is gone", async () => {
    const db = makeTestDatabase();
    const failing = createApp({
      db,
      uploadsDir: makeTempDir(),
      frontendDir: makeTempDir(),
    });
    db.close();

    const res = await request(failing).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.database).toBe("disconnected");
  });
});

describe("drink photos", () => {
  let app: Express;
  let uploadsDir: string;
  beforeAll(() => ({ app, uploadsDir } = makeTestApp()));

  it("serves a photo that exists", async () => {
    fs.writeFileSync(path.join(uploadsDir, "drink-1.png"), "not-really-a-png");

    const res = await request(app).get("/uploads/drink-1.png");

    expect(res.status).toBe(200);
    expect(res.type).toBe("image/png");
  });

  it("gives an error for a missing photo instead of a web page", async () => {
    const res = await request(app).get("/uploads/missing.png");

    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
  });
});

describe("web pages", () => {
  it("sends the app for unknown addresses when pages are bundled", async () => {
    const frontendDir = makeTempDir("barkeep-frontend-");
    fs.writeFileSync(path.join(frontendDir, "index.html"), "<!doctype html>ok");

    const app = createApp({
      db: makeTestDatabase(),
      uploadsDir: makeTempDir(),
      frontendDir,
    });

    const res = await request(app).get("/some/page/in/the/app");

    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
  });

  it("still answers unknown api addresses with an error", async () => {
    const frontendDir = makeTempDir("barkeep-frontend-");
    fs.writeFileSync(path.join(frontendDir, "index.html"), "<!doctype html>ok");

    const app = createApp({
      db: makeTestDatabase(),
      uploadsDir: makeTempDir(),
      frontendDir,
    });

    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
  });
});
