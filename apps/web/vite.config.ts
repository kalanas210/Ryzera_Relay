import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

const api = process.env.RELAY_API_URL ?? "http://localhost:8765";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // The app shell is cached so the driver's phone opens Relay with no signal; records wait in IndexedDB.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png", "fonts/*.woff2"],
      manifest: {
        name: "Relay",
        short_name: "Relay",
        description: "Delivery planning for Waypoint Group, from order to receipt.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F5F7F9",
        theme_color: "#0F5563",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: api, changeOrigin: false } },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
