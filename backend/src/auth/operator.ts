import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

import { COOKIE_SECURE, SESSION_TTL_MS } from "../config.js";
import { decodeToken, encodeToken, readCookie } from "./tokens.js";

// The operator's sign-in, kept apart from the bar session on purpose: its own
// cookie, so a host can be tending a bar and be operator on the same device
// without one signing the other out.

/** The signed contents of the operator cookie. It names no bar — it sees all. */
interface OperatorPayload {
  v: 1;
  role: "operator";
  iat: number;
  exp: number;
}

const COOKIE_NAME = "operator";

/** Turns an operator sign-in into a signed cookie value. */
export function signOperator(now: number = Date.now()): string {
  const payload: OperatorPayload = {
    v: 1,
    role: "operator",
    iat: now,
    exp: now + SESSION_TTL_MS,
  };

  return encodeToken(payload);
}

function isOperatorPayload(
  value: unknown,
  now: number
): value is OperatorPayload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;

  return (
    p["v"] === 1 &&
    p["role"] === "operator" &&
    typeof p["iat"] === "number" &&
    typeof p["exp"] === "number" &&
    p["exp"] > now
  );
}

/** True when the cookie is one we signed and hasn't run out. */
export function verifyOperator(
  token: string,
  now: number = Date.now()
): boolean {
  return isOperatorPayload(decodeToken(token), now);
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: COOKIE_SECURE,
  path: "/",
} as const;

/** Sends the signed operator cookie back on a reply. */
export function setOperatorCookie(res: Response): void {
  res.cookie(COOKIE_NAME, signOperator(), {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_TTL_MS,
  });
}

/** Clears it, on sign-out. */
export function clearOperatorCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
}

/** Reads the operator cookie out of the request, if it's there. */
export function readOperatorCookie(req: Request): string | undefined {
  return readCookie(req, COOKIE_NAME);
}

/**
 * Whether the panel is switched on at all. Unset password means no operator,
 * so the sign-in refuses and the panel can't be reached.
 */
export function operatorEnabled(
  password: string | undefined
): password is string {
  return typeof password === "string" && password.length > 0;
}

/** A constant-time password check, so timing gives nothing away. */
export function operatorPasswordMatches(
  input: string,
  expected: string
): boolean {
  const given = Buffer.from(input);
  const wanted = Buffer.from(expected);

  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
