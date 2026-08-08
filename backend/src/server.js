import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import path from "path";
import fs from "fs";

import {
  PORT,
  NODE_ENV,
  DB_PATH,
  UPLOADS_DIR,
  FRONTEND_DIR,
  CORS_ORIGIN,
  TRUST_PROXY,
} from "./config.js";
// Importing the database opens it and runs migrations before any route module
// is loaded.
import { db, closeDatabase } from "./db/index.js";

import barRoutes from "./routes/bars.js";
import drinkRoutes from "./routes/drinks.js";
import orderRoutes from "./routes/orders.js";
import authRoutes from "./routes/auth.js";
import categoryRoutes from "./routes/categories.js";

import { setupWebSocket } from "./websocket/handler.js";

const app = express();
const server = createServer(app);

// Lets QR codes use the address guests actually came in on when a reverse
// proxy sits in front.
app.set("trust proxy", TRUST_PROXY);

// Same-origin in the packaged deployment, so CORS is only wired up when an
// origin is explicitly configured (i.e. running against the Vite dev server).
if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Uploaded drink images. Served from the same origin as the app, so the
// relative /uploads/... paths stored in the database resolve without a proxy.
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    maxAge: "7d",
    fallthrough: false,
  })
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

app.use("/api/bars", barRoutes);
app.use("/api/drinks", drinkRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);

// Must sit before the SPA fallback, otherwise unknown API routes answer with
// index.html instead of JSON.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Built frontend. Absent during local development, where Vite serves it.
const hasFrontend = fs.existsSync(path.join(FRONTEND_DIR, "index.html"));

if (hasFrontend) {
  app.use(express.static(FRONTEND_DIR));

  app.get("*", (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "index.html"));
  });
}

// Error handler. Must be last, and must take four arguments for Express to
// recognise it as one.
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large. Maximum size is 5MB." });
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

// The WebSocket server shares the HTTP server and listens on the same port, so
// there is nothing extra to expose or proxy.
const wss = new WebSocketServer({ server, path: "/ws" });
app.locals.wss = setupWebSocket(wss);

server.listen(PORT, () => {
  console.log(`🍸 Bar running on port ${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`📁 Uploads:  ${UPLOADS_DIR}`);
  console.log(
    `📁 Frontend: ${hasFrontend ? FRONTEND_DIR : "not bundled (served by Vite in development)"}`
  );
  console.log(`🌍 Environment: ${NODE_ENV}`);
});

let shuttingDown = false;

const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting connections, then drop the WebSocket clients that would
  // otherwise keep the server open until the force-exit timer fires.
  server.close(() => {
    closeDatabase();
    console.log("Graceful shutdown complete.");
    process.exit(0);
  });

  for (const client of wss.clients) {
    client.close(1001, "Server shutting down");
  }
  wss.close();

  setTimeout(() => {
    console.error("Could not close connections in time, forcing shutdown");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});
