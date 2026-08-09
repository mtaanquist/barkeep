import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The API shapes, the same ones the server builds against.
    alias: { "@shared": new URL("../shared", import.meta.url).pathname },
  },
  test: {
    // A stand-in browser, so components can be rendered and clicked.
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
