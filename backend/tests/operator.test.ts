import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

import {
  makeTestApp,
  cleanUpTempDirs,
  seedBar,
  operatorCookie,
  sessionCookie,
} from "./helpers.js";
import type { Db } from "../src/db/queries.js";

afterAll(cleanUpTempDirs);

const PASSWORD = "back-of-house";

describe("the operator panel", () => {
  let app: Express;
  let db: Db;
  let barId: number;

  beforeEach(() => {
    ({ app, db } = makeTestApp({ operatorPassword: PASSWORD }));
    ({ barId } = seedBar(db));
  });

  describe("signing in", () => {
    it("refuses the wrong password", async () => {
      const res = await request(app)
        .post("/api/operator/login")
        .send({ password: "nope" });
      expect(res.status).toBe(401);
    });

    it("takes the right password and sets an operator cookie", async () => {
      const res = await request(app)
        .post("/api/operator/login")
        .send({ password: PASSWORD });

      expect(res.status).toBe(200);
      expect(String(res.headers["set-cookie"])).toMatch(/operator=/);
    });

    it("is switched off entirely when no password is configured", async () => {
      const { app: noPanel } = makeTestApp();

      const res = await request(noPanel)
        .post("/api/operator/login")
        .send({ password: "anything" });

      expect(res.status).toBe(401);
    });
  });

  describe("who may reach it", () => {
    it("turns away a request with no cookie", async () => {
      const res = await request(app).get("/api/operator/bars");
      expect(res.status).toBe(401);
    });

    it("turns away a bartender's cookie — it's the wrong door", async () => {
      const res = await request(app)
        .get("/api/operator/bars")
        .set("Cookie", sessionCookie({ barId, role: "bartender" }));
      expect(res.status).toBe(401);
    });

    it("lets the operator cookie in", async () => {
      const res = await request(app)
        .get("/api/operator/me")
        .set("Cookie", operatorCookie());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ operator: true });
    });
  });

  describe("listing bars", () => {
    it("lists every bar with when it was last used", async () => {
      const res = await request(app)
        .get("/api/operator/bars")
        .set("Cookie", operatorCookie());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: barId,
        name: "Test Bar",
        deletedAt: null,
        lastUsed: null,
      });
    });
  });

  describe("retiring a bar", () => {
    const retire = (name: string) =>
      request(app)
        .delete(`/api/operator/bars/${barId}`)
        .set("Cookie", operatorCookie())
        .send({ confirmationName: name });

    it("needs the exact name typed to confirm", async () => {
      expect((await retire("Wrong Name")).status).toBe(400);
    });

    it("marks the bar rather than removing it, and hides it everywhere else", async () => {
      expect((await retire("Test Bar")).status).toBe(200);

      // Gone from the public list a guest or bartender would see.
      const list = await request(app).get("/api/bars");
      expect(list.body).toHaveLength(0);

      // Can no longer be signed into — findBar no longer finds it.
      const signIn = await request(app)
        .post("/api/auth/bartender")
        .send({ barId, password: "x" });
      expect(signIn.status).toBe(404);

      // But the operator still sees it, marked with when it went.
      const ops = await request(app)
        .get("/api/operator/bars")
        .set("Cookie", operatorCookie());
      expect(ops.body).toHaveLength(1);
      expect(ops.body[0].deletedAt).toBeTruthy();

      // The row itself survives, ready to be restored.
      const row = db
        .prepare("SELECT deleted_at FROM bars WHERE id = ?")
        .get(barId) as { deleted_at: string | null };
      expect(row.deleted_at).toBeTruthy();
    });

    it("can be brought back before the purge takes it", async () => {
      await retire("Test Bar");

      const res = await request(app)
        .post(`/api/operator/bars/${barId}/restore`)
        .set("Cookie", operatorCookie());
      expect(res.status).toBe(200);

      const list = await request(app).get("/api/bars");
      expect(list.body).toHaveLength(1);
    });
  });
});
