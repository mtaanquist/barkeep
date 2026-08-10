import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";

import {
  makeTestApp,
  seedBar,
  sessionCookie,
  cleanUpTempDirs,
} from "./helpers.js";
import { signSession, verifySession } from "../src/auth/session.js";

afterAll(cleanUpTempDirs);

// The token is what the whole scheme rests on: it has to survive a round trip
// and fall over the moment it's tampered with or out of date.
describe("session tokens", () => {
  it("signs a token it can read back", () => {
    const token = signSession({ barId: 7, role: "bartender" });
    expect(verifySession(token)).toMatchObject({ barId: 7, role: "bartender" });
  });

  it("carries a guest's name", () => {
    const token = signSession({ barId: 1, role: "guest", name: "Ada" });
    expect(verifySession(token)?.name).toBe("Ada");
  });

  it("turns down a tampered token", () => {
    const token = signSession({ barId: 1, role: "bartender" });
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifySession(tampered)).toBeNull();
  });

  it("turns down an expired token", () => {
    // Signed as if long ago, so its expiry is already in the past.
    const token = signSession({ barId: 1, role: "bartender" }, 1000);
    expect(verifySession(token)).toBeNull();
  });

  it("turns down nonsense", () => {
    expect(verifySession("")).toBeNull();
    expect(verifySession("not-a-token")).toBeNull();
    expect(verifySession("a.b")).toBeNull();
  });
});

describe("the sign-in cookie", () => {
  it("is set, HttpOnly and Lax, when a bartender signs in", async () => {
    const { app } = makeTestApp();
    const created = await request(app).post("/api/bars").send({
      name: "Cookie Bar",
      bartenderPassword: "shaker",
      guestPassword: "gin",
    });

    const res = await request(app)
      .post("/api/auth/bartender")
      .send({ barId: created.body.id, password: "shaker" });

    expect(res.status).toBe(200);
    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("is set when a bar is created", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/bars").send({
      name: "Fresh Bar",
      bartenderPassword: "shaker",
      guestPassword: "gin",
    });

    expect(res.status).toBe(201);
    expect(res.headers["set-cookie"]?.[0] ?? "").toMatch(/^session=/);
  });
});

describe("GET /api/auth/me", () => {
  it("reports the bartender the cookie names", async () => {
    const { app, db } = makeTestApp();
    const { barId } = seedBar(db);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie({ barId, role: "bartender" }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      userType: "bartender",
      bar: { id: barId },
    });
  });

  it("gives a guest their name back", async () => {
    const { app, db } = makeTestApp();
    const { barId } = seedBar(db);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie({ barId, role: "guest", name: "Ada" }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userType: "guest", customerName: "Ada" });
  });

  it("never leaks the stored passwords", async () => {
    const { app, db } = makeTestApp();
    const { barId } = seedBar(db);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie({ barId, role: "bartender" }));

    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|guest_token/);
  });

  it("turns away a request with no cookie", async () => {
    const { app } = makeTestApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("turns away a forged cookie", async () => {
    const { app, db } = makeTestApp();
    const { barId } = seedBar(db);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `session=${barId}.forged`);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toMatch(/^session=/);
    // A cleared cookie is one with an expiry already gone by.
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});
