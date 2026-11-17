// Standalone build for Cloudflare Workers (no Lovable wrapper needed).
// `vite build` produces dist/client (static assets) and dist/<worker> (SSR),
// and `wrangler deploy` ships both. VITE_* variables from .env / the build
// environment are exposed to the app as import.meta.env.VITE_*.
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    // src/server.ts wraps the TanStack Start entry with the branded SSR error page.
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
