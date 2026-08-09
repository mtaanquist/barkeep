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
