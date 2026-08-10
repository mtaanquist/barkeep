import { describe, it, expect, afterAll } from "vitest";
import bcrypt from "bcrypt";

import { makeTestDatabase, cleanUpTempDirs } from "./helpers.js";
import { resetBarPassword, generateResetCode } from "../src/passwords/reset.js";
import { parseResetArgs } from "../src/cli/reset-code.js";
import type { Db } from "../src/db/queries.js";

afterAll(cleanUpTempDirs);

/** A bar whose two codes we know, so we can prove which one changed. */
function seedWithKnownCodes(db: Db): number {
  const info = db
    .prepare(
      "INSERT INTO bars (name, bartender_password_hash, guest_password_hash) VALUES ('Test Bar', ?, ?)"
    )
    .run(bcrypt.hashSync("old-bartender", 8), bcrypt.hashSync("old-guest", 8));
  return Number(info.lastInsertRowid);
}

const hashesOf = (db: Db, barId: number) =>
  db
    .prepare(
      "SELECT bartender_password_hash AS b, guest_password_hash AS g FROM bars WHERE id = ?"
    )
    .get(barId) as { b: string; g: string };

describe("resetting a bar's password", () => {
  it("sets a new guest code and leaves the bartender's alone", async () => {
    const db = makeTestDatabase();
    const barId = seedWithKnownCodes(db);

    const { code, barName } = await resetBarPassword(db, barId, "guest");
    expect(barName).toBe("Test Bar");

    const { b, g } = hashesOf(db, barId);
    // The printed code is the new guest code...
    expect(bcrypt.compareSync(code, g)).toBe(true);
    // ...the old guest code no longer works...
    expect(bcrypt.compareSync("old-guest", g)).toBe(false);
    // ...and the bartender code is untouched.
    expect(bcrypt.compareSync("old-bartender", b)).toBe(true);
  });

  it("sets a new bartender code and leaves the guest's alone", async () => {
    const db = makeTestDatabase();
    const barId = seedWithKnownCodes(db);

    const { code } = await resetBarPassword(db, barId, "bartender");

    const { b, g } = hashesOf(db, barId);
    expect(bcrypt.compareSync(code, b)).toBe(true);
    expect(bcrypt.compareSync("old-guest", g)).toBe(true);
  });

  it("refuses a bar that isn't there", async () => {
    const db = makeTestDatabase();
    await expect(resetBarPassword(db, 9999, "guest")).rejects.toThrow(/no bar/i);
  });
});

describe("the reset code itself", () => {
  it("is two groups of look-alike-free characters", () => {
    expect(generateResetCode()).toMatch(/^[a-hj-np-z2-9]{5}-[a-hj-np-z2-9]{5}$/);
  });

  it("is different each time", () => {
    expect(generateResetCode()).not.toBe(generateResetCode());
  });
});

describe("reading the command line", () => {
  it("takes a bar and a guest/bartender choice", () => {
    expect(parseResetArgs(["--bar", "3", "--guest"])).toEqual({
      barId: 3,
      role: "guest",
    });
    expect(parseResetArgs(["--bartender", "--bar", "1"])).toEqual({
      barId: 1,
      role: "bartender",
    });
  });

  it("asks for a bar when none is given", () => {
    expect(() => parseResetArgs(["--guest"])).toThrow(/which bar/i);
  });

  it("asks for exactly one role", () => {
    expect(() => parseResetArgs(["--bar", "1"])).toThrow(/which code/i);
    expect(() =>
      parseResetArgs(["--bar", "1", "--guest", "--bartender"])
    ).toThrow(/which code/i);
  });

  it("offers help when asked", () => {
    expect(parseResetArgs(["--help"])).toEqual({ help: true });
  });
});
