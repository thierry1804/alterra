import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // App shell: cache-first. API calls are handled by SyncManager/IndexedDB, not Workbox.
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/(sites|activities|workers)\b/,
            handler: "CacheFirst",
            options: {
              cacheName: "referentiels-cache",
              expiration: { maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      manifest: {
        name: "ALTERRA Terrain",
        short_name: "ALTERRA",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [],
      },
    }),
  ],
  server: {
    host: true,
    port: 5174,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
