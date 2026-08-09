import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries into their own chunks
          "react-vendor": ["react", "react-dom"],
          router: ["react-router-dom"],
          markdown: ["@uiw/react-md-editor"],
          icons: ["lucide-react"],
        },
      },
    },
    // Increase the chunk size warning limit to 800kb to reduce noise
    chunkSizeWarningLimit: 800,
  },
});
