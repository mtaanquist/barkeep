import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repository/app root: one level above src/
const APP_ROOT = path.resolve(__dirname, "..");

export const PORT = Number(process.env.PORT) || 3000;

export const NODE_ENV = process.env.NODE_ENV || "development";

// Existing deployments bind-mount their database here. Do not change the
// default without a migration path for them.
export const DB_PATH = path.resolve(
  process.env.DB_PATH || path.join(APP_ROOT, "data", "bar.db")
);

// Uploaded drink images. Served at /uploads and written to by multer.
export const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR || path.join(APP_ROOT, "uploads")
);

// Built frontend assets. In the published image these sit next to the backend;
// in local development the frontend is served by Vite instead and this path
// simply won't exist, which is handled at startup.
export const FRONTEND_DIR = path.resolve(
  process.env.FRONTEND_DIR || path.join(APP_ROOT, "public")
);

// Only needed when the frontend is served from a different origin, i.e. `npm run
// dev` against the Vite dev server. In the single-container deployment
// everything is same-origin and CORS is left off entirely.
export const CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_URL;

// Absolute base URL used when generating QR codes. Left unset, it is derived
// from the incoming request, which is correct for both direct access and a
// reverse proxy that sets X-Forwarded-*. Set it explicitly when the address
// guests use differs from the one the bartender's browser sees.
export const PUBLIC_URL = (
  process.env.PUBLIC_URL ||
  process.env.FRONTEND_URL ||
  ""
).replace(/\/+$/, "");
