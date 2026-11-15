/**
 * The static social-preview image and the legacy favicon (launch audit F-20).
 *
 *   npx tsx packages/web/scripts/og-image.ts
 *
 * Writes, from the SVG sources in this file, two committed binaries:
 *
 *   public/og.png       1200×630, the image `og:image` / `twitter:image` name.
 *                       Text-free apart from the brand: one image serves seven
 *                       languages, and a sentence in it would put German on the
 *                       Turkish page (the one-language-per-page rule, #449).
 *   public/favicon.ico  the 32×32 favicon as a PNG-in-ICO, for the clients that
 *                       ask for `/favicon.ico` before reading any `<link>`.
 *
 * Rendered by the Playwright Chromium the e2e suite already uses — no image
 * library is added to the tree. Run it by hand when the mark changes;
 * `test/og-image.test.ts` checks the committed files' dimensions and shape, so
 * a stale or broken binary is a red test, not a silent one.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const PUBLIC = new URL("../public/", import.meta.url).pathname;

/** The favicon's mark (public/favicon.svg), drawn large on the brand blue. */
export const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a4a93"/>
  <rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="#fff" stroke-width="6"/>
  <g transform="translate(150 155) scale(10)">
    <rect width="32" height="32" rx="6" fill="#0a4a93"/>
    <rect x="2.5" y="2.5" width="27" height="27" rx="4.5" fill="none" stroke="#fff" stroke-width="1.5"/>
    <path d="M19 7 13 25" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="4 3.5"/>
  </g>
  <text x="560" y="350" fill="#fff" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="128" font-weight="700">ViaFrei</text>
</svg>`;

async function render(svg: string, width: number, height: number): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
    return await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
  } finally {
    await browser.close();
  }
}

/** One PNG wrapped as a single-image ICO (PNG payloads are valid ICO entries since Windows Vista). */
export function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // no palette
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}

async function main(): Promise<void> {
  const og = await render(OG_SVG, 1200, 630);
  writeFileSync(join(PUBLIC, "og.png"), og);
  const { readFileSync } = await import("node:fs");
  const fav = readFileSync(join(PUBLIC, "favicon.svg"), "utf8");
  const icon = await render(fav, 32, 32);
  writeFileSync(join(PUBLIC, "favicon.ico"), pngToIco(icon, 32));
  console.log(`og.png ${String(og.length)} bytes, favicon.ico ${String(icon.length + 22)} bytes`);
}

if (import.meta.url === `file://${process.argv[1] ?? ""}`) await main();
