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
import type { Realtime } from "./realtime.js";
import { prepareStoredPhotos, sweepUnusedPhotos } from "./uploads.js";
import { purgeSoftDeleted } from "./db/purge.js";

const db = openDatabase(DB_PATH);
const app = createApp({ db });
const realtime = app.locals["realtime"] as Realtime;
const server = createServer(app);

// A photo is saved before its drink is, so an abandoned form leaves one
// behind. Clear out anything old that nothing refers to.
const SWEEP_EVERY_MS = 24 * 60 * 60 * 1000;

const sweepPhotos = (): void => {
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

// Photos used to be kept at whatever size and format they arrived in, which
// is what made the bar slow to open. Bars that have been running a while have
// a folder full of those, so they are caught up once on start. Nothing waits
// on it.
prepareStoredPhotos({ db, uploadsDir: UPLOADS_DIR })
  .then((prepared) => {
    if (prepared.length) console.log(`Prepared ${prepared.length} photo(s)`);
  })
  .catch((error) => console.error("Could not prepare photos:", error));

// A bar the operator retired sits recoverable for a while, then goes for good.
// Checked on start and once a day, so one left past the window is cleared even
// on a container that stays up for weeks.
const purgeBars = (): void => {
  try {
    const removed = purgeSoftDeleted(db);
    if (removed) {
      console.log(`Removed ${removed} retired bar(s) past the retention window`);
    }
  } catch (error) {
    console.error("Could not remove retired bars:", error);
  }
};

purgeBars();
setInterval(purgeBars, SWEEP_EVERY_MS).unref();

server.listen(PORT, () => {
  console.log(`🍸 Bar running on port ${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`📁 Uploads:  ${UPLOADS_DIR}`);
  console.log(`📁 Frontend: ${FRONTEND_DIR}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
});

let shuttingDown = false;

const gracefulShutdown = (signal: string): void => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    closeDatabase(db);
    console.log("Graceful shutdown complete.");
    process.exit(0);
  });

  // Without this the open update connections would hold the server open.
  realtime.closeAll();

  setTimeout(() => {
    console.error("Could not close connections in time, forcing shutdown");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason: unknown) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});
