import type { Request, Response } from "express";

import type { UserType } from "../../../shared/types.js";
import { COOKIE_SECURE, GUEST_SESSION_TTL_MS, SESSION_TTL_MS } from "../config.js";
import { decodeToken, encodeToken, readCookie } from "./tokens.js";

/** Who someone is, once their cookie has been checked. */
export interface Session {
  barId: number;
  role: UserType;
  /** A guest's name, so an order can't be placed or cancelled as someone else. */
  name?: string;
  /** A guest who proved a password for their name — a "regular". */
  authenticated?: boolean;
}

/** A guest's cookie outlives the bartender's single shift. */
function ttlFor(role: UserType): number {
  return role === "guest" ? GUEST_SESSION_TTL_MS : SESSION_TTL_MS;
}

/** The signed contents of a cookie: a session, plus when it was made and dies. */
export interface SessionPayload extends Session {
  v: 1;
  iat: number;
  exp: number;
}

/** The one cookie we set. */
const COOKIE_NAME = "session";

/** Turns a session into a signed cookie value. */
export function signSession(session: Session, now: number = Date.now()): string {
  const payload: SessionPayload = {
    v: 1,
    barId: session.barId,
    role: session.role,
    // Only carry these when they're set — the type won't take undefined.
    ...(session.name !== undefined ? { name: session.name } : {}),
    ...(session.authenticated ? { authenticated: true } : {}),
    iat: now,
    exp: now + ttlFor(session.role),
  };

  return encodeToken(payload);
}

function isSessionPayload(value: unknown, now: number): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;

  return (
    p["v"] === 1 &&
    typeof p["barId"] === "number" &&
    (p["role"] === "bartender" || p["role"] === "guest") &&
    typeof p["iat"] === "number" &&
    typeof p["exp"] === "number" &&
    p["exp"] > now &&
    (p["name"] === undefined || typeof p["name"] === "string") &&
    (p["authenticated"] === undefined || typeof p["authenticated"] === "boolean")
  );
}

/** A cookie value back to a session, or null if it's forged, spoiled or old. */
export function verifySession(
  token: string,
  now: number = Date.now()
): SessionPayload | null {
  const parsed = decodeToken(token);
  return isSessionPayload(parsed, now) ? parsed : null;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: COOKIE_SECURE,
  path: "/",
} as const;

/** Sends the signed cookie back on a reply. */
export function setSessionCookie(res: Response, session: Session): void {
  res.cookie(COOKIE_NAME, signSession(session), {
    ...COOKIE_OPTIONS,
    maxAge: ttlFor(session.role),
  });
}

/** Clears it, on sign-out. */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
}

/** Reads our cookie out of the request, if it's there. */
export function readSessionCookie(req: Request): string | undefined {
  return readCookie(req, COOKIE_NAME);
}
