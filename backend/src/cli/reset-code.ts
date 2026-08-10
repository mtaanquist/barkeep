import { pathToFileURL } from "node:url";

import { openDatabase, closeDatabase } from "../db/index.js";
import { DB_PATH } from "../config.js";
import { resetBarPassword, type PasswordRole } from "../passwords/reset.js";

// Recovering a lost code from the machine itself. Whoever runs this already has
// the server's files, which is the right proof for "I have lost the password" —
// and it works even when the app won't start, because it never starts it.

const USAGE = `Set a new password for one bar and print it once.

  npm run reset-code -- --bar <id> --guest
  npm run reset-code -- --bar <id> --bartender

Use it when a code has been lost. The new code is shown once and only its hash
is kept, so write it down when it appears.`;

interface ResetRequest {
  barId: number;
  role: PasswordRole;
}

/** Reads the request out of the command line, or explains what's missing. */
export function parseResetArgs(argv: string[]): ResetRequest | { help: true } {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };

  const barAt = argv.indexOf("--bar");
  const barId = barAt === -1 ? NaN : Number(argv[barAt + 1]);

  const guest = argv.includes("--guest");
  const bartender = argv.includes("--bartender");

  if (!Number.isInteger(barId) || barId <= 0) {
    throw new Error("Which bar? Pass --bar <id> with a whole number.");
  }
  if (guest === bartender) {
    throw new Error("Which code? Pass exactly one of --guest or --bartender.");
  }

  return { barId, role: guest ? "guest" : "bartender" };
}

async function main(): Promise<void> {
  const parsed = parseResetArgs(process.argv.slice(2));

  if ("help" in parsed) {
    console.log(USAGE);
    return;
  }

  const db = openDatabase(DB_PATH);
  try {
    const { barName, code } = await resetBarPassword(
      db,
      parsed.barId,
      parsed.role
    );
    const which = parsed.role === "guest" ? "Guest" : "Bartender";

    console.log(`\n${which} code for "${barName}" is now:\n`);
    console.log(`    ${code}\n`);
    console.log("Shown once — write it down. Only its hash is stored.\n");
  } finally {
    closeDatabase(db);
  }
}

// Only run when this file is the program, so a test can import parseResetArgs
// without opening a database.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Run with --help for usage.");
    process.exitCode = 1;
  });
}
