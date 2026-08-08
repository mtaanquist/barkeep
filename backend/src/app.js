import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import {
  NODE_ENV,
  UPLOADS_DIR,
  FRONTEND_DIR,
  CORS_ORIGIN,
  PUBLIC_URL,
  TRUST_PROXY,
} from "./config.js";

import createBarRoutes from "./routes/bars.js";
import createDrinkRoutes from "./routes/drinks.js";
import createOrderRoutes from "./routes/orders.js";
import createAuthRoutes from "./routes/auth.js";
import createCategoryRoutes from "./routes/categories.js";
import { createRealtime } from "./realtime.js";

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
} = {}) {
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

  if (requestLogging) {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  // Drink photos, served from the same address as everything else so the
  // stored /uploads/... paths just work.
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use(
    "/uploads",
    express.static(uploadsDir, { maxAge: "7d", fallthrough: false })
  );

  app.get("/api/health", (req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        database: "connected",
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({
        status: "ERROR",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error.message,
      });
    }
  });

  // Live order updates. Kept on app.locals so routes can reach it.
  const realtime = createRealtime();
  app.locals.realtime = realtime;
  app.get("/api/events", (req, res) => realtime.subscribe(req, res));

  app.use("/api/bars", createBarRoutes({ db, publicUrl }));
  app.use("/api/drinks", createDrinkRoutes({ db, uploadsDir }));
  app.use("/api/orders", createOrderRoutes(db));
  app.use("/api/auth", createAuthRoutes(db));
  app.use("/api/categories", createCategoryRoutes(db));

  // Must come before the catch-all below, or unknown addresses under /api
  // would answer with a web page instead of an error.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // The built web pages. Absent during development, where Vite serves them.
  if (fs.existsSync(path.join(frontendDir, "index.html"))) {
    app.use(express.static(frontendDir));
    app.get("*", (req, res) => {
      res.sendFile(path.join(frontendDir, "index.html"));
    });
  }

  app.use((err, req, res, next) => {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 5MB." });
    }
    if (err.message === "Only image files are allowed!") {
      return res.status(400).json({ error: "Only image files are allowed." });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: "Not found" });
    }

    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: NODE_ENV === "development" ? err.message : "Something went wrong",
    });
  });

  return app;
}
