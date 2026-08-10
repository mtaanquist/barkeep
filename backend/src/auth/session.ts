import fs from "fs";
import path from "path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

import type { UserType } from "../../../shared/types.js";
import {
  COOKIE_SECURE,
  NODE_ENV,
  SESSION_SECRET,
  SESSION_SECRET_FILE,
  SESSION_TTL_MS,
} from "../config.js";

/** Who someone is, once their cookie has been checked. */
export interface Session {
  barId: number;
  role: UserType;
  /** A guest's name, so an order can't be placed or cancelled as someone else. */
  name?: string;
}

/** The signed contents of a cookie: a session, plus when it was made and dies. */
export interface SessionPayload extends Session {
  v: 1;
  iat: number;
  exp: number;
}

/** The one cookie we set. */
const COOKIE_NAME = "session";

let cachedSecret: string | undefined;

/**
 * The signing key. Prefer the environment; in tests keep one in memory so no
 * file is written; otherwise keep a generated one on disk so a restart doesn't
 * sign everybody out.
 */
function secret(): string {
  if (cachedSecret !== undefined) return cachedSecret;

  if (SESSION_SECRET) {
    cachedSecret = SESSION_SECRET;
  } else if (NODE_ENV === "test") {
    cachedSecret = randomBytes(32).toString("hex");
  } else {
    cachedSecret = readOrCreateSecretFile();
  }

  return cachedSecret;
}

function readOrCreateSecretFile(): string {
  try {
    const existing = fs.readFileSync(SESSION_SECRET_FILE, "utf8").trim();
    if (existing) return existing;
  } catch {
    // Not there the first time; made below.
  }

  const fresh = randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(SESSION_SECRET_FILE), { recursive: true });
  // Owner-only: nobody else on the box should read the signing key.
  fs.writeFileSync(SESSION_SECRET_FILE, fresh, { mode: 0o600 });
  return fresh;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Turns a session into a signed cookie value. */
export function signSession(session: Session, now: number = Date.now()): string {
  const payload: SessionPayload = {
    v: 1,
    barId: session.barId,
    role: session.role,
    // Only carry a name when there is one — the type won't take undefined.
    ...(session.name !== undefined ? { name: session.name } : {}),
    iat: now,
    exp: now + SESSION_TTL_MS,
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
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
    (p["name"] === undefined || typeof p["name"] === "string")
  );
}

/** A cookie value back to a session, or null if it's forged, spoiled or old. */
export function verifySession(
  token: string,
  now: number = Date.now()
): SessionPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const wanted = Buffer.from(sign(body));

  // Same length first, then a constant-time compare so timing gives nothing away.
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

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
    maxAge: SESSION_TTL_MS,
  });
}

/** Clears it, on sign-out. */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
}

/** Reads our cookie out of the request, if it's there. */
export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }

  return undefined;
}
