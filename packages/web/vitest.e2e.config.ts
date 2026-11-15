import { defineConfig } from "vitest/config";

/**
 * The browser-level spikes (#376 S2, S3) run against the BUILT server, so they
 * live outside the root suite's `*.test.ts` glob as `*.e2e.ts` and are run by
 * `npm run web:test`, which builds first. Same offline guard as every other
 * test process: the browser's requests are answered by Playwright's router,
 * never by the network.
 */
export default defineConfig({
  test: {
    include: ["packages/web/e2e/**/*.e2e.ts"],
    environment: "node",
    setupFiles: ["./packages/ingest/src/platform/offline-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
