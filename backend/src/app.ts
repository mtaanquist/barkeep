import express, { type Express } from "express";
import cors from "cors";
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
import { createRealtime } from "./realtime.js";
import type { Db } from "./db/queries.js";

import createBarRoutes from "./routes/bars.js";
import createDrinkRoutes from "./routes/drinks.js";
import createOrderRoutes from "./routes/orders.js";
import createAuthRoutes from "./routes/auth.js";
import createCategoryRoutes from "./routes/categories.js";
import createOperatorRoutes from "./routes/operator.js";

export interface AppOptions {
  db: Db;
  uploadsDir?: string;
  frontendDir?: string;
  corsOrigin?: string | undefined;
  publicUrl?: string;
  trustProxy?: TrustProxy;
  requestLogging?: boolean;
  /** The operator panel's password. Unset switches the panel off. */
  operatorPassword?: string | undefined;
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
  operatorPassword = OPERATOR_PASSWORD,
}: AppOptions): Express {
  if (!db) throw new Error("createApp needs a database");

  const app = express();

  // Lets QR codes use the address guests actually came in on when a reverse
  // proxy sits in front.
  app.set("trust proxy", trustProxy);

  if (corsOrigin) {
    app.use(cors({ origin: corsOrigin, credentials: true }));
  }

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

  app.use("/api/bars", createBarRoutes({ db, publicUrl }));
  app.use("/api/drinks", createDrinkRoutes({ db, uploadsDir }));
  app.use("/api/orders", createOrderRoutes(db));
  app.use("/api/auth", createAuthRoutes(db));
  app.use("/api/categories", createCategoryRoutes(db));
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
