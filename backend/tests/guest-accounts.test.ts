import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

import {
  makeTestApp,
  seedBar,
  sessionCookie,
  cleanUpTempDirs,
} from "./helpers.js";
import type { Db } from "../src/db/queries.js";
import { GUEST_SESSION_TTL_MS, SESSION_TTL_MS } from "../src/config.js";

afterAll(cleanUpTempDirs);

// A known QR token on a seeded bar, so the token-login door opens without
// depending on how the original fixed token is spelled.
function seedBarWithToken(db: Db): {
  barId: number;
  drinkId: number;
  token: string;
} {
  const { barId, drinkId } = seedBar(db);
  const token = "qr-token";
  db.prepare("UPDATE bars SET guest_token = ? WHERE id = ?").run(token, barId);
  return { barId, drinkId, token };
}

function tokenLogin(
  app: Express,
  barId: number,
  token: string,
  body: { customerName: string; accountPassword?: string }
) {
  return request(app)
    .post(`/api/bars/${barId}/guest-token-login`)
    .send({ token, ...body });
}

describe("claiming a name", () => {
  it("lets a one-time guest in without a password and claims nothing", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);

    const res = await tokenLogin(app, barId, token, { customerName: "Bea" });

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(false);
    // Nobody claimed anything.
    const account = db
      .prepare("SELECT * FROM guest_accounts WHERE bar_id = ?")
      .get(barId);
    expect(account).toBeUndefined();
  });

  it("claims the name when a guest sets a password, and marks them a regular", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);

    const res = await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    const account = db
      .prepare("SELECT name FROM guest_accounts WHERE bar_id = ?")
      .get(barId) as { name: string } | undefined;
    expect(account?.name).toBe("Ada");
  });

  it("refuses a claimed name with no password, and says so distinctly", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    const res = await tokenLogin(app, barId, token, { customerName: "Ada" });

    expect(res.status).toBe(401);
    // The pages branch on this to reveal the password field.
    expect(res.body.code).toBe("name_claimed");
  });

  it("refuses a claimed name with the wrong password", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    const res = await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "guess",
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("password_incorrect");
  });

  it("lets the regular back in with the right password", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    const res = await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
  });

  it("claims a name once, whatever the case, and remembers its spelling", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    // A differently-cased spelling is the same claimed name...
    const clash = await tokenLogin(app, barId, token, { customerName: "ADA" });
    expect(clash.status).toBe(401);
    expect(clash.body.code).toBe("name_claimed");

    // ...and signing in keeps the spelling the name was claimed with, so the
    // one set of favourites and history stays put.
    const back = await tokenLogin(app, barId, token, {
      customerName: "ada",
      accountPassword: "secret",
    });
    expect(back.status).toBe(200);
    expect(back.body.customerName).toBe("Ada");
  });
});

describe("existing guests keep what's theirs", () => {
  it("keeps favourites reachable after the name is claimed", async () => {
    const { app, db } = makeTestApp();
    const { barId, drinkId, token } = seedBarWithToken(db);

    // A favourite marked as an anonymous guest named Ada, before any password.
    const anon = sessionCookie({ barId, role: "guest", name: "Ada" });
    const marked = await request(app)
      .post(`/api/drinks/bar/${barId}/favourites`)
      .set("Cookie", anon)
      .send({ drinkId });
    expect(marked.status).toBe(201);

    // Now Ada claims her name.
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    // The favourite from before is still hers.
    const favourites = await request(app)
      .get(`/api/drinks/bar/${barId}/favourites/Ada`)
      .set("Cookie", anon);
    expect(favourites.status).toBe(200);
    expect(favourites.body).toHaveLength(1);
  });
});

describe("the guest cookie outlives the bartender's", () => {
  it("gives a guest a much longer cookie than a bartender", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);

    const res = await tokenLogin(app, barId, token, { customerName: "Bea" });
    const cookie = res.headers["set-cookie"]?.[0] ?? "";

    const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie)?.[1]);
    // Seconds, and it should be the guest length, well past the bartender day.
    expect(maxAge).toBe(GUEST_SESSION_TTL_MS / 1000);
    expect(maxAge).toBeGreaterThan(SESSION_TTL_MS / 1000);
  });
});

describe("the bartender's list of regulars", () => {
  it("lists claimed names, and never a password", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    const res = await request(app)
      .get(`/api/bars/${barId}/regulars`)
      .set("Cookie", sessionCookie({ barId, role: "bartender" }));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: "Ada" });
    expect(JSON.stringify(res.body)).not.toMatch(/password/);
  });

  it("is the bartender's alone", async () => {
    const { app, db } = makeTestApp();
    const { barId } = seedBar(db);

    const asGuest = await request(app)
      .get(`/api/bars/${barId}/regulars`)
      .set("Cookie", sessionCookie({ barId, role: "guest", name: "Ada" }));
    expect(asGuest.status).toBe(403);

    const noCookie = await request(app).get(`/api/bars/${barId}/regulars`);
    expect(noCookie.status).toBe(401);
  });
});

describe("renaming a regular", () => {
  it("carries their favourites and past orders to the new name", async () => {
    const { app, db } = makeTestApp();
    const { barId, drinkId } = seedBarWithToken(db);

    // A favourite and a settled order under the bare name, then the claim.
    db.prepare(
      "INSERT INTO user_favourites (bar_id, customer_name, drink_id) VALUES (?, 'Ada', ?)"
    ).run(barId, drinkId);
    db.prepare(
      "INSERT INTO orders (bar_id, customer_name, drink_id, drink_title, status) VALUES (?, 'Ada', ?, 'Negroni', 'processed')"
    ).run(barId, drinkId);
    const account = db
      .prepare("INSERT INTO guest_accounts (bar_id, name, password_hash) VALUES (?, 'Ada', 'x')")
      .run(barId);
    const accountId = Number(account.lastInsertRowid);

    const res = await request(app)
      .put(`/api/bars/${barId}/regulars/${accountId}`)
      .set("Cookie", sessionCookie({ barId, role: "bartender" }))
      .send({ name: "Ada Lovelace" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Ada Lovelace" });

    const favNames = db
      .prepare("SELECT DISTINCT customer_name AS n FROM user_favourites WHERE bar_id = ?")
      .all(barId)
      .map((r) => (r as { n: string }).n);
    expect(favNames).toEqual(["Ada Lovelace"]);

    const orderNames = db
      .prepare("SELECT DISTINCT customer_name AS n FROM orders WHERE bar_id = ?")
      .all(barId)
      .map((r) => (r as { n: string }).n);
    expect(orderNames).toEqual(["Ada Lovelace"]);
  });

  it("frees the old name and keeps the password on the new one", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });
    const accountId = Number(
      (
        db
          .prepare("SELECT id FROM guest_accounts WHERE bar_id = ?")
          .get(barId) as { id: number }
      ).id
    );

    await request(app)
      .put(`/api/bars/${barId}/regulars/${accountId}`)
      .set("Cookie", sessionCookie({ barId, role: "bartender" }))
      .send({ name: "Bea" });

    // The old name is free for a one-time guest again.
    const oldName = await tokenLogin(app, barId, token, { customerName: "Ada" });
    expect(oldName.status).toBe(200);
    expect(oldName.body.authenticated).toBe(false);

    // The new name still needs the same password.
    const newNoPw = await tokenLogin(app, barId, token, { customerName: "Bea" });
    expect(newNoPw.status).toBe(401);
    const newWithPw = await tokenLogin(app, barId, token, {
      customerName: "Bea",
      accountPassword: "secret",
    });
    expect(newWithPw.status).toBe(200);
    expect(newWithPw.body.authenticated).toBe(true);
  });

  it("won't collide with a name another regular already holds", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });
    await tokenLogin(app, barId, token, {
      customerName: "Bea",
      accountPassword: "other",
    });
    const adaId = Number(
      (
        db
          .prepare("SELECT id FROM guest_accounts WHERE name = 'Ada' AND bar_id = ?")
          .get(barId) as { id: number }
      ).id
    );

    const res = await request(app)
      .put(`/api/bars/${barId}/regulars/${adaId}`)
      .set("Cookie", sessionCookie({ barId, role: "bartender" }))
      .send({ name: "Bea" });

    expect(res.status).toBe(409);
  });
});

describe("the bartender resetting a regular's password", () => {
  it("sets a new password without asking for the old one", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });
    const accountId = Number(
      (
        db
          .prepare("SELECT id FROM guest_accounts WHERE bar_id = ?")
          .get(barId) as { id: number }
      ).id
    );

    const res = await request(app)
      .put(`/api/bars/${barId}/regulars/${accountId}/password`)
      .set("Cookie", sessionCookie({ barId, role: "bartender" }))
      .send({ newPassword: "freshone" });
    expect(res.status).toBe(200);

    // The old password no longer works; the one the bartender set does.
    const oldPw = await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });
    expect(oldPw.status).toBe(401);
    const newPw = await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "freshone",
    });
    expect(newPw.status).toBe(200);
    expect(newPw.body.authenticated).toBe(true);
  });

  it("is the bartender's alone", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });
    const accountId = Number(
      (
        db
          .prepare("SELECT id FROM guest_accounts WHERE bar_id = ?")
          .get(barId) as { id: number }
      ).id
    );

    const asGuest = await request(app)
      .put(`/api/bars/${barId}/regulars/${accountId}/password`)
      .set("Cookie", sessionCookie({ barId, role: "guest", name: "Ada" }))
      .send({ newPassword: "freshone" });
    expect(asGuest.status).toBe(403);
  });
});

describe("claiming a name from inside the bar", () => {
  it("lets a signed-in guest set a password and become a regular", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);

    const res = await request(app)
      .post("/api/auth/guest/claim")
      .set("Cookie", sessionCookie({ barId, role: "guest", name: "Ada" }))
      .send({ password: "secret" });

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.customerName).toBe("Ada");

    // The name is claimed now: proving it at the door works, and a bare login
    // is turned away.
    const proved = await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });
    expect(proved.status).toBe(200);
    expect(proved.body.authenticated).toBe(true);

    const bare = await tokenLogin(app, barId, token, { customerName: "Ada" });
    expect(bare.status).toBe(401);
  });

  it("refuses a name that is already claimed", async () => {
    const { app, db } = makeTestApp();
    const { barId } = seedBar(db);
    db.prepare(
      "INSERT INTO guest_accounts (bar_id, name, password_hash) VALUES (?, 'Ada', 'x')"
    ).run(barId);

    const res = await request(app)
      .post("/api/auth/guest/claim")
      .set("Cookie", sessionCookie({ barId, role: "guest", name: "Ada" }))
      .send({ password: "secret" });

    expect(res.status).toBe(409);
  });

  it("is only for a signed-in guest", async () => {
    const { app, db } = makeTestApp();
    const { barId } = seedBar(db);

    const noCookie = await request(app)
      .post("/api/auth/guest/claim")
      .send({ password: "secret" });
    expect(noCookie.status).toBe(401);

    const asBartender = await request(app)
      .post("/api/auth/guest/claim")
      .set("Cookie", sessionCookie({ barId, role: "bartender" }))
      .send({ password: "secret" });
    expect(asBartender.status).toBe(403);
  });
});

describe("changing a regular's password", () => {
  it("turns away a one-time guest who never claimed a name", async () => {
    const { app, db } = makeTestApp();
    const { barId } = seedBar(db);

    const res = await request(app)
      .put("/api/auth/guest/password")
      .set("Cookie", sessionCookie({ barId, role: "guest", name: "Bea" }))
      .send({ currentPassword: "x", newPassword: "yyyy" });

    // Not authenticated → forbidden, before any password is even looked at.
    expect(res.status).toBe(403);
  });

  it("lets a regular change their password with the right current one", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    const regular = sessionCookie({
      barId,
      role: "guest",
      name: "Ada",
      authenticated: true,
    });

    const res = await request(app)
      .put("/api/auth/guest/password")
      .set("Cookie", regular)
      .send({ currentPassword: "secret", newPassword: "another" });
    expect(res.status).toBe(200);

    // The old password no longer gets them in; the new one does.
    const oldPw = await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });
    expect(oldPw.status).toBe(401);
    const newPw = await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "another",
    });
    expect(newPw.status).toBe(200);
  });

  it("refuses a change when the current password is wrong", async () => {
    const { app, db } = makeTestApp();
    const { barId, token } = seedBarWithToken(db);
    await tokenLogin(app, barId, token, {
      customerName: "Ada",
      accountPassword: "secret",
    });

    const res = await request(app)
      .put("/api/auth/guest/password")
      .set(
        "Cookie",
        sessionCookie({ barId, role: "guest", name: "Ada", authenticated: true })
      )
      .send({ currentPassword: "wrong", newPassword: "another" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("password_incorrect");
  });
});
