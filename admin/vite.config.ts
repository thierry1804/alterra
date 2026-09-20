import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    port: 5173,
    allowedHosts: ["alterra-admin.boss-etech.net"],
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PROXY_PORT ?? 3001}`,
        changeOrigin: true,
        xfwd: true, // transmet X-Forwarded-For — sans ça le backend ne voit que l'IP du proxy Vite
      },
    },
  },
});
