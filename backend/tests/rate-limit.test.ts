import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  makeTestDatabase,
  makeTempDir,
  cleanUpTempDirs,
} from "./helpers.js";
import { ADMIN_ATTEMPT_LIMIT } from "../src/rateLimit.js";

afterAll(cleanUpTempDirs);

const OPERATOR_PASSWORD = "operator-secret";

/** An app with throttling switched on (it is off by default under test). */
function makeApp() {
  return createApp({
    db: makeTestDatabase(),
    uploadsDir: makeTempDir(),
    frontendDir: makeTempDir(),
    rateLimit: true,
    operatorPassword: OPERATOR_PASSWORD,
  });
}

describe("throttling wrong passwords", () => {
  it("turns a run of wrong passwords away once the limit is passed", async () => {
    const app = makeApp();

    // The limiter lets this many wrong tries through before it steps in.
    for (let i = 0; i < ADMIN_ATTEMPT_LIMIT; i++) {
      const res = await request(app)
        .post("/api/operator/login")
        .send({ password: "wrong" });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post("/api/operator/login")
      .send({ password: "wrong" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many/i);
  });

  it("does not count the ones that get in, so a real crowd is never locked out", async () => {
    const app = makeApp();

    // Well past the limit, but every one succeeds, so none of them count.
    for (let i = 0; i < ADMIN_ATTEMPT_LIMIT + 5; i++) {
      const res = await request(app)
        .post("/api/operator/login")
        .send({ password: OPERATOR_PASSWORD });
      expect(res.status).toBe(200);
    }
  });
});
