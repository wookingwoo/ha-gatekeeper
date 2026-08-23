import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/admin": "http://localhost:8080",
      "/api": "http://localhost:8080",
      "/healthz": "http://localhost:8080"
    }
  }
});
