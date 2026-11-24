import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(import.meta.dirname, "src"), "@shared": resolve(import.meta.dirname, "shared") } },
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, "index.html"), text: resolve(import.meta.dirname, "text.html") } } },
  server: { proxy: { "/api": "http://127.0.0.1:8431" } },
});
