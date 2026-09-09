import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
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
