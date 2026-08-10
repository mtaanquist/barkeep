import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_ROOT = path.resolve(__dirname, "..");

export const PORT: number = Number(process.env.PORT) || 3000;

export const NODE_ENV: string = process.env.NODE_ENV || "development";

// Existing installs keep their database here. Changing this strands it.
export const DB_PATH = path.resolve(
  process.env.DB_PATH || path.join(APP_ROOT, "data", "bar.db")
);

// Drink photos.
export const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR || path.join(APP_ROOT, "uploads")
);

// The built web pages. Missing during development, where Vite serves them.
export const FRONTEND_DIR = path.resolve(
  process.env.FRONTEND_DIR || path.join(APP_ROOT, "public")
);

// Only needed in development, when the pages come from a different address.
export const CORS_ORIGIN: string | undefined =
  process.env.CORS_ORIGIN || process.env.FRONTEND_URL;

// Web address to put in QR codes. Worked out from the request if unset.
export const PUBLIC_URL = (
  process.env.PUBLIC_URL ||
  process.env.FRONTEND_URL ||
  ""
).replace(/\/+$/, "");

// Which reverse proxies are allowed to tell us the address guests used. By
// default only ones on this machine or the local network, so an outsider
// can't point QR codes somewhere else.
export type TrustProxy = boolean | number | string;

export const TRUST_PROXY: TrustProxy = (() => {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === "") return "loopback, linklocal, uniquelocal";
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
})();

// How long a bartender's sign-in lasts. Their screen sits on a counter all
// night, so a whole day rather than a short idle window.
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// A guest's sign-in lasts longer: a regular who claimed their name shouldn't
// have to type it again across a weekend of parties. Set GUEST_SESSION_TTL_DAYS
// to change it; the default is a month.
export const GUEST_SESSION_TTL_MS: number =
  (Number(process.env.GUEST_SESSION_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000;

// The key that signs sign-in cookies. Set SESSION_SECRET so it stays the same
// across restarts (and across several servers). Left unset, the server keeps a
// generated one in a file next to the database — see auth/session.ts.
export const SESSION_SECRET: string | undefined =
  process.env.SESSION_SECRET || undefined;

// Where that generated key is kept when SESSION_SECRET is unset: next to the
// database, on the folder that already survives an upgrade.
export const SESSION_SECRET_FILE = path.join(
  path.dirname(DB_PATH),
  ".session-secret"
);

// Only send the cookie over HTTPS when the public address is HTTPS. Plain-http
// development has to work without it, or the cookie never arrives.
export const COOKIE_SECURE: boolean = PUBLIC_URL.startsWith("https://");

// The password for the operator panel, which lists every bar and can retire a
// dead one. Kept out of the database on purpose, so recovering a bar never
// depends on the database being readable. Left unset, the panel is switched
// off and its sign-in always refuses.
export const OPERATOR_PASSWORD: string | undefined =
  process.env.OPERATOR_PASSWORD || undefined;

// How long a bar the operator retired sits recoverable before it is removed for
// good. A whole row survives the wait, so a mistaken delete can be undone.
export const SOFT_DELETE_RETENTION_DAYS: number =
  Number(process.env.SOFT_DELETE_RETENTION_DAYS) || 60;
