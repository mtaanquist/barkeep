// The compiler only emits JavaScript, so the schema and migration files have
// to be carried across to the build output by hand.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, "../src/db");
const to = path.join(here, "../dist/db");

fs.mkdirSync(path.join(to, "migrations"), { recursive: true });

let copied = 0;

for (const relative of ["schema.sql", ...fs
  .readdirSync(path.join(from, "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .map((name) => path.join("migrations", name))]) {
  fs.copyFileSync(path.join(from, relative), path.join(to, relative));
  copied += 1;
}

console.log(`Copied ${copied} SQL file(s) into the build`);
