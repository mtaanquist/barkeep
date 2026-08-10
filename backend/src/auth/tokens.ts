import fs from "fs";
import path from "path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

import {
  NODE_ENV,
  SESSION_SECRET,
  SESSION_SECRET_FILE,
} from "../config.js";

// The signing key and the envelope around it, shared by every cookie we sign:
// the bar session and the operator session both mint tokens the same way, so
// the one careful HMAC and constant-time check live here rather than in two.

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

/** HMAC-SHA256 of a token body, as base64url. */
function signBody(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Constant-time check that a signature belongs to a body. */
function signatureMatches(body: string, providedSig: string): boolean {
  const given = Buffer.from(providedSig);
  const wanted = Buffer.from(signBody(body));

  // Same length first, then a constant-time compare so timing gives nothing away.
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** Wraps a payload as `base64url(json).signature`. */
export function encodeToken(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signBody(body)}`;
}

/**
 * Unwraps a token to its parsed payload, or null when the signature is wrong or
 * the body isn't JSON. The caller checks the shape — this only proves we signed
 * it and it parses.
 */
export function decodeToken(token: string): unknown | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  if (!signatureMatches(body, token.slice(dot + 1))) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Reads one named cookie off a request, if it's there. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }

  return undefined;
}
