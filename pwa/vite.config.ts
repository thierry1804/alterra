import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const apiProxy = {
  "/api": {
    target: `http://localhost:${process.env.API_PROXY_PORT ?? 3001}`,
    changeOrigin: true,
    xfwd: true, // transmet X-Forwarded-For — sans ça le backend ne voit que l'IP du proxy
  },
};

// En-têtes de sécurité du service public (vite preview). Mêmes valeurs que nginx.static.conf, utilisé en production.
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(self), geolocation=(self), microphone=()",
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    // Le serveur de dev est exposé via le tunnel Cloudflare : sans restriction Vite sert
    // n'importe quel fichier lisible par l'utilisateur (ex. /etc/passwd) — vu exploité en prod.
    fs: {
      strict: true,
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(new URL("../design", import.meta.url)),
        fileURLToPath(new URL("../node_modules", import.meta.url)),
      ],
      deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.git/**", "**/secrets/**"],
    },
    port: 5174,
    allowedHosts: ["alterra-pwa.boss-etech.net"],
    proxy: apiProxy,
  },
  // Service public (tunnel Cloudflare) : build statique, sans serveur de dev ni accès aux sources.
  preview: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    allowedHosts: ["alterra-pwa.boss-etech.net"],
    headers: securityHeaders,
    proxy: apiProxy,
  },
});
