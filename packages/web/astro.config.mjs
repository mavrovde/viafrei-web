// @ts-check
// The viafrei.de site shell (#375 A1). Astro renders on demand behind the
// existing nginx `landing` container; Svelte is the island language and there
// is exactly one island in 1.6 — the consent bar (#375 A6).
//
// Every choice here is a line of #376 PR-01, and each one is a budget or a
// security rule rather than a taste:
//   output "server"           the public paths are negotiated per request (A4)
//                             and the CSP header is set per request (A6), so
//                             nothing here is prerendered.
//   @astrojs/node standalone  one process, one port (8792), no extra server.
//   ssr.noExternal: true      the WHOLE server bundle is in dist/, so the
//                             runtime image installs nothing for this
//                             workspace and `scripts/check_image_deps.sh` §1
//                             stays true (spike S1).
//   inlineStylesheets never   ONE external stylesheet per page, which is what
//                             `style-src 'self'` needs — no inline <style>
//                             element anywhere (spike S2).
//   build.assets "_a"         the stylesheet is served at /_a/site.<hash>.css
//                             with the adapter's immutable cache header.
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [svelte()],
  server: { port: 8792, host: "127.0.0.1" },
  build: { inlineStylesheets: "never", assets: "_a" },
  devToolbar: { enabled: false },
  compressHTML: true,
  vite: {
    ssr: { noExternal: true },
    build: {
      rollupOptions: {
        output: { assetFileNames: "_a/site.[hash][extname]" },
      },
    },
  },
});
