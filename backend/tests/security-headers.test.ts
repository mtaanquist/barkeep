import { describe, it, expect, afterAll } from "vitest";
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

describe("security headers", () => {
  it("sets a content security policy and the usual guards on every reply", async () => {
    const { app } = makeTestApp();
    const res = await request(app).get("/api/health");

    const csp = res.headers["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("img-src 'self' data: blob:");

    // A plain-http bar on a home network must keep working, so this one is off.
    expect(csp).not.toContain("upgrade-insecure-requests");

    // Helmet's other headers ride along.
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("names the built page's inline script by its hash, not 'unsafe-inline'", async () => {
    // A frontend folder with an index.html carrying one inline script, the way
    // the real build ships the theme-flash guard.
    const frontendDir = makeTempDir("barkeep-frontend-");
    fs.writeFileSync(
      path.join(frontendDir, "index.html"),
      "<!doctype html><script>console.log('theme')</script><div id=root></div>"
    );

    const app = createApp({
      db: makeTestDatabase(),
      uploadsDir: makeTempDir(),
      frontendDir,
    });

    const res = await request(app).get("/api/health");
    const csp = res.headers["content-security-policy"];

    expect(csp).toMatch(/script-src [^;]*'sha256-[A-Za-z0-9+/=]+'/);
    // Inline script is allowed by hash, never wholesale.
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
  });
});
