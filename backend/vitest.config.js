import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Each test file gets its own database and folders, so they can run at
    // the same time without tripping over each other.
    include: ["tests/**/*.test.ts"],
    env: { NODE_ENV: "test" },
  },
});
