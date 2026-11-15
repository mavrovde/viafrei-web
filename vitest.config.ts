import { defineConfig } from "vitest/config";

/**
 * The unit suite of the site shell and the design building blocks (viafrei-web#2;
 * viafrei's root `vitest.config.ts` "unit" project, scoped to the two packages
 * that moved).
 *
 * "Never a live provider call in tests/CI" is enforced, not merely intended: the
 * offline guard runs inside every test file and fails any socket to a host
 * outside the allow-list. It is the guard of the pinned viafrei-app release
 * (`scripts/pinned-app.sh`), the same file viafrei's suite installs.
 *
 * `test/` is the release tooling's suite, mirrored from viafrei-database
 * (ci-gate, approve-release-runs, ghcr-not-released, zap-verdict, workflows).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "test/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      // cross-repo (viafrei-web#2, docs/moved-from-viafrei.md): whole files whose other side is a RECORDED
      // fixture of viafrei's — provider payloads and real local answers, which do not travel into this
      // repository (it is to be public, and the payloads' terms are viafrei's) — so they are not run here.
      "packages/web/test/city-jams-agreement.test.ts", // fixtures/mobilithek/recorded/*.xml + a migrated database
      "packages/web/test/station-describe-parity.test.ts", // fixtures/stada/station-pages.json
      "packages/web/test/place-asks.test.ts", // packages/mcp/src/server/site-examples.fixture.json
    ],
    setupFiles: ["./.pinned/app/packages/ingest/dist/platform/offline-setup.js"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: { provider: "v8", reporter: ["text", "lcov"], reportsDirectory: "coverage" },
  },
});
