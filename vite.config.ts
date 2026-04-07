import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    // true → listen on all addresses; avoids -102 / connection issues some clients have with "::" + localhost
    host: true,
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon.svg", "robots.txt", "placeholder.svg"],
      manifest: {
        id: "./",
        name: "Berrylicious",
        short_name: "Berrylicious",
        description:
          "Book a table, browse the menu, and order — premium dining in Windhoek.",
        theme_color: "#0b0b0b",
        background_color: "#0b0b0b",
        display: "standalone",
        display_override: ["standalone", "minimal-ui", "browser"],
        scope: "./",
        start_url: "./",
        lang: "en",
        dir: "ltr",
        categories: ["food", "lifestyle"],
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/functions\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@tanstack/react-query")) return "react-query";
          if (id.includes("react-dom") || id.includes("react-router")) return "react-vendor";
          if (id.includes("/node_modules/react/")) return "react-vendor";
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
