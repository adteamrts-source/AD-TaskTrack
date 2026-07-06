import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves on :5173 and proxies /api + /accounts to Django on :8000.
// Build: assets are emitted under /static/ so Django (whitenoise) serves them,
// and the bundle lands in backend/frontend_build for collectstatic.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/static/" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/accounts": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  build: {
    outDir: "../backend/frontend_build",
    emptyOutDir: true,
  },
}));
