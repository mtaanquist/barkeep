import { createServer } from "http";

import {
  PORT,
  NODE_ENV,
  DB_PATH,
  UPLOADS_DIR,
  FRONTEND_DIR,
} from "./config.js";
import { openDatabase, closeDatabase } from "./db/index.js";
import { createApp } from "./app.js";
import { sweepUnusedPhotos } from "./uploads.js";

const db = openDatabase(DB_PATH);
const app = createApp({ db });
const server = createServer(app);

// A photo is saved before its drink is, so an abandoned form leaves one
// behind. Clear out anything old that nothing refers to.
const SWEEP_EVERY_MS = 24 * 60 * 60 * 1000;

const sweepPhotos = () => {
  try {
    const removed = sweepUnusedPhotos({ db, uploadsDir: UPLOADS_DIR });
    if (removed.length) {
      console.log(`Removed ${removed.length} unused photo(s)`);
    }
  } catch (error) {
    console.error("Could not tidy up photos:", error);
  }
};

sweepPhotos();
setInterval(sweepPhotos, SWEEP_EVERY_MS).unref();

server.listen(PORT, () => {
  console.log(`🍸 Bar running on port ${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`📁 Uploads:  ${UPLOADS_DIR}`);
  console.log(`📁 Frontend: ${FRONTEND_DIR}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
});

let shuttingDown = false;

const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    closeDatabase(db);
    console.log("Graceful shutdown complete.");
    process.exit(0);
  });

  // Without this the open update connections would hold the server open.
  app.locals.realtime.closeAll();

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
