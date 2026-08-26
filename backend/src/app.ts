import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { createHash } from "node:crypto";
import path from "path";
import fs from "fs";

import {
  UPLOADS_DIR,
  FRONTEND_DIR,
  CORS_ORIGIN,
  PUBLIC_URL,
  TRUST_PROXY,
  NODE_ENV,
  OPERATOR_PASSWORD,
  type TrustProxy,
} from "./config.js";
import { errorReply, route } from "./http.js";
import { attachSession } from "./auth/middleware.js";
import { adminLoginLimiter, guestLoginLimiter } from "./rateLimit.js";
import { createRealtime } from "./realtime.js";
import type { Db } from "./db/queries.js";

import createBarRoutes from "./routes/bars.js";
import createDrinkRoutes from "./routes/drinks.js";
import createOrderRoutes from "./routes/orders.js";
import createAuthRoutes from "./routes/auth.js";
import createCategoryRoutes from "./routes/categories.js";
import createIngredientRoutes from "./routes/ingredients.js";
import createOperatorRoutes from "./routes/operator.js";

export interface AppOptions {
  db: Db;
  uploadsDir?: string;
  frontendDir?: string;
  corsOrigin?: string | undefined;
  publicUrl?: string;
  trustProxy?: TrustProxy;
  requestLogging?: boolean;
  /** Throttle repeated wrong passwords on the sign-in routes. Off in tests. */
  rateLimit?: boolean;
  /** The operator panel's password. Unset switches the panel off. */
  operatorPassword?: string | undefined;
}

/**
 * The hashes of any inline <script> in the built page, so the policy below can
 * name them without opening the door to inline script in general. The one we
 * have settles light or dark before the first paint; its bytes are fixed at
 * build time, so reading them here keeps the policy in step with the page even
 * if that script changes.
 */
function inlineScriptHashes(frontendDir: string): string[] {
  const indexFile = path.join(frontendDir, "index.html");
  if (!fs.existsSync(indexFile)) return [];

  const html = fs.readFileSync(indexFile, "utf8");
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const body = match[1] ?? "";
    const digest = createHash("sha256").update(body, "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

/**
 * What a browser may load and where it may talk to. Everything comes from this
 * one origin already; the loose ends are the QR code (a data: image), the
 * inline theme script (named by its hash), and inline styles the pages and the
 * recipe editor set. `upgrade-insecure-requests` is left off on purpose, so a
 * bar served over plain http on a home network still works.
 */
function securityPolicy(frontendDir: string) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", ...inlineScriptHashes(frontendDir)],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'self'"],
        "upgrade-insecure-requests": null,
      },
    },
    // The QR image and drink photos are read cross-page by design.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

/**
 * Builds the app. Nothing here listens on a port or opens a database, so a
 * test can hand in its own and check the app on its own terms.
 */
export function createApp({
  db,
  uploadsDir = UPLOADS_DIR,
  frontendDir = FRONTEND_DIR,
  corsOrigin = CORS_ORIGIN,
  publicUrl = PUBLIC_URL,
  trustProxy = TRUST_PROXY,
  requestLogging = NODE_ENV !== "test",
  rateLimit = NODE_ENV !== "test",
  operatorPassword = OPERATOR_PASSWORD,
}: AppOptions): Express {
  if (!db) throw new Error("createApp needs a database");

  const app = express();

  // Security headers first, so every reply carries them.
  app.use(securityPolicy(frontendDir));

  // Lets QR codes use the address guests actually came in on when a reverse
  // proxy sits in front.
  app.set("trust proxy", trustProxy);

  if (corsOrigin) {
    app.use(cors({ origin: corsOrigin, credentials: true }));
  }

  // Photos come through multer, not here, so a request body is only ever small
  // fields. 1mb is plenty and caps how much an unsigned caller can make us hold.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Reads the sign-in cookie, if any, before the routes and the live feed run.
  app.use(attachSession);

  if (requestLogging) {
    app.use((req, _res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  // Drink photos, served from the same address as everything else so the
  // stored /uploads/... paths just work.
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      maxAge: "7d",
      fallthrough: false,
      // Serve the file as exactly the type its extension says, so a browser
      // won't sniff a stored file into something it can run.
      setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
    })
  );

  app.get(
    "/api/health",
    route((_req, res) => {
      try {
        db.prepare("SELECT 1").get();
      } catch (error) {
        console.error("Health check failed:", error);
        res.status(503).json({
          status: "ERROR",
          timestamp: new Date().toISOString(),
          database: "disconnected",
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        database: "connected",
      });
    })
  );

  // Live order updates. Kept on app.locals so routes can reach it.
  const realtime = createRealtime();
  app.locals["realtime"] = realtime;
  app.get("/api/events", (req, res) => realtime.subscribe(req, res));

  // Throttle wrong passwords on the sign-in routes, before the routes run.
  if (rateLimit) {
    const admin = adminLoginLimiter();
    const guest = guestLoginLimiter();
    app.use("/api/auth/bartender", admin);
    app.use("/api/operator/login", admin);
    app.use("/api/auth/guest", guest);
    app.use("/api/bars/:id/guest-token-login", guest);
  }

  app.use("/api/bars", createBarRoutes({ db, publicUrl }));
  app.use("/api/drinks", createDrinkRoutes({ db, uploadsDir }));
  app.use("/api/orders", createOrderRoutes(db));
  app.use("/api/auth", createAuthRoutes(db));
  app.use("/api/categories", createCategoryRoutes(db));
  app.use("/api/ingredients", createIngredientRoutes(db));
  app.use("/api/operator", createOperatorRoutes({ db, operatorPassword }));

  // Must come before the catch-all below, or unknown addresses under /api
  // would answer with a web page instead of an error.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // The built web pages. Absent during development, where Vite serves them.
  if (fs.existsSync(path.join(frontendDir, "index.html"))) {
    app.use(express.static(frontendDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDir, "index.html"));
    });
  }

  app.use(errorReply);

  return app;
}
