/**
 * The owner's preview: full-page screenshots of the built home, DE and EN,
 * 390 px and 1280 px, light and dark, written to `design/preview/` and
 * referenced from `design/components.md` (#376 PR-02).
 *
 * Boots `dist/server/entry.mjs` on a loopback port with no GOOGLE_TAG (so the
 * page is the zero-script case), screenshots, and asserts that the browser
 * console stayed silent — a CSP violation or a 404 for the stylesheet would
 * show up there and make the screenshots a picture of a defect.
 *
 *   npm run build -w @viafrei/web && npx tsx packages/web/scripts/preview-shots.ts
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startRealDigest } from "../e2e/real-digest.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const out = join(pkg, "design", "preview");
const PORT = 8798;

async function waitFor(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not answer on ${url} within ${ms} ms`);
}

// Tiles come from the REAL digest renderer over a fixture snapshot
// (e2e/real-digest.ts): production's markup and size, fixture figures.
const stub = await startRealDigest();
const server = spawn(process.execPath, [join(pkg, "dist", "server", "entry.mjs")], {
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(PORT), ASTRO_NODE_LOGGING: "disabled", GOOGLE_TAG: "", DIGEST_URL: stub.url },
  stdio: "inherit",
});
try {
  await waitFor(`http://127.0.0.1:${PORT}/de`, 5000);
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let shots = 0;
  for (const lang of ["de", "en"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      for (const width of [390, 1280] as const) {
        const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const problems: string[] = [];
        page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`); });
        page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
        page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()}`));
        await page.goto(`http://127.0.0.1:${PORT}/${lang}`, { waitUntil: "networkidle" });
        const file = join(out, `home-${lang}-${width}-${scheme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        if (scrollWidth > width) problems.push(`horizontal overflow: scrollWidth ${scrollWidth} > ${width}`);
        if (problems.length) throw new Error(`${file}:\n  ${problems.join("\n  ")}`);
        console.log(`wrote ${file}`);
        shots += 1;
        await ctx.close();
      }
    }
  }
  await browser.close();
  console.log(`${shots} screenshots, console silent, no horizontal overflow`);
} finally {
  server.kill();
  await stub.close();
}
