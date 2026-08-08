// Sets up or updates the database without starting the bar. The server does
// this itself on every start, so this is only here for manual use.
import { openDatabase, closeDatabase } from "./index.js";
import { DB_PATH } from "../config.js";

const db = openDatabase(DB_PATH);

console.log("Database initialized successfully!");
console.log(`Database location: ${DB_PATH}`);

closeDatabase(db);
