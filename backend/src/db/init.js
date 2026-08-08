// Standalone database initialisation.
//
// The server now runs migrations itself on every boot, so this script is only
// kept for manual use (`npm run init-db`) — e.g. creating or inspecting a
// database without starting the app. It is no longer part of the deployment.
import { db, closeDatabase } from "./index.js";
import { DB_PATH } from "../config.js";

console.log("Database initialized successfully!");
console.log(`Database location: ${DB_PATH}`);

closeDatabase();
