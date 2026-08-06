import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

import dns from "node:dns";

dns.setDefaultResultOrder("verbatim");

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: {
      host: "localhost",
    },
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // @supabase/realtime-js uses a module entry that imports a broken @supabase/phoenix ESM.
    // Force it to use the CJS main entry instead.
    mainFields: ["browser", "main", "module"],
  },
});

