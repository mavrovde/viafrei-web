/**
 * #1185 R3/R4/R5 (data-steward ruling 2026-11-04), rendered: the footer's "Privacy settings" link is on every page
 * exactly when a `GOOGLE_TAG` is configured, and which consent island a page carries follows the measured set — the
 * bar (`Consent.svelte`) on a measured page, the settings dialog only (`ConsentSettings.svelte`, which loads nothing)
 * on a page without analytics, and no island on the fuel board, which runs no script (its link goes to the Datenschutz
 * page's settings anchor). The real page components are compiled by Astro's Vite plugin over the e2e fixture's real
 * digest (loopback, no database, no network), as in `in-page-anchors.test.ts`. The browser half is
 * `e2e/consent-1185.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { all } from "@viafrei/design/testing";
import { startRealDigest } from "../e2e/real-digest.js";
import { pathFor, type Lang } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { PRIVACY_SETTINGS_ANCHOR } from "../src/analytics/consent-store.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://viafrei.de";
let digest: Awaited<ReturnType<typeof startRealDigest>> | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;
/** The legal pages refuse to render without the § 5 DDG identity; planted values, as `pages-content.test.ts` does. */
const IDENTITY = { IMPRESSUM_NAME: "Erika Mustermann", IMPRESSUM_STREET: "Musterstraße 1", IMPRESSUM_CITY: "12345 Musterstadt", IMPRESSUM_EMAIL: "e@example.invalid" } as const;
const saved: Record<string, string | undefined> = Object.fromEntries(["DIGEST_URL", ...Object.keys(IDENTITY)].map((k) => [k, process.env[k]]));

type Island = "bar" | "settings" | "none";
type Page = { readonly name: string; readonly file: string; readonly params: Record<string, string>; readonly path: string; readonly island: Island };

/** German is the binding legal text and lives at the site root (`/impressum`), every other language under its prefix. */
const legal = (lang: Lang, id: string): string => (lang === "de" ? `/src/pages/${id}.astro` : `/src/pages/[lang]/${id}.astro`);

const pages = (lang: Lang): readonly Page[] => [
  { name: "home (measured)", file: "/src/pages/[lang]/index.astro", params: { lang }, path: pathFor("start", lang), island: "bar" },
  { name: "connect (measured)", file: "/src/pages/[lang]/connect.astro", params: { lang }, path: pathFor("connect", lang), island: "bar" },
  { name: "place page (unmeasured)", file: "/src/pages/[lang]/place/[slug].astro", params: { lang, slug: "koeln" }, path: placePath(lang, "koeln"), island: "settings" },
  { name: "Datenschutz (unmeasured)", file: legal(lang, "datenschutz"), params: lang === "de" ? {} : { lang }, path: pathFor("datenschutz", lang), island: "settings" },
  { name: "Impressum (unmeasured)", file: legal(lang, "impressum"), params: lang === "de" ? {} : { lang }, path: pathFor("impressum", lang), island: "settings" },
  { name: "fuel board (no script)", file: "/src/pages/[lang]/fuel.astro", params: { lang }, path: pathFor("fuel", lang), island: "none" },
];

beforeAll(async () => {
  digest = await startRealDigest();
  process.env["DIGEST_URL"] = digest.url;
  Object.assign(process.env, IDENTITY);
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  // the islands are Svelte: the server renderer is loaded through the same Vite graph that compiled the components
  const svelte = (await vite.ssrLoadModule("@astrojs/svelte/server.js")) as { default: Parameters<AstroContainer["addServerRenderer"]>[0] extends { renderer: infer R } ? R : never };
  container.addServerRenderer({ name: "@astrojs/svelte", renderer: svelte.default });
  container.addClientRenderer({ name: "@astrojs/svelte", entrypoint: "@astrojs/svelte/client.js" });
  // compile the page graph once here, so each test only renders
  for (const file of new Set([...pages("de"), ...pages("en")].map((p) => p.file))) await vite.ssrLoadModule(file);
});

afterAll(async () => {
  await vite?.close();
  await digest?.close();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

async function render(p: Page, googleTag: string | undefined): Promise<string> {
  if (vite === undefined) throw new Error("vite did not start");
  const mod = (await vite.ssrLoadModule(p.file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  return container.renderToString(mod.default, {
    params: p.params,
    request: new Request(`${ORIGIN}${p.path}`, { headers: { "accept-language": "de", "user-agent": "Mozilla/5.0" } }),
    locals: { nonce: "n", googleTag, clarityId: undefined, mapPlatform: "other" },
  });
}

const islands = (html: string): { bar: number; settings: number } => ({
  bar: [...html.matchAll(/component-url="[^"]*\/Consent\.svelte[^"]*"/gu)].length,
  settings: [...html.matchAll(/component-url="[^"]*\/ConsentSettings\.svelte[^"]*"/gu)].length,
});
const label = (lang: Lang): string => (JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), "utf8")) as { footer: { privacySettings: string } }).footer.privacySettings;
const settingsLinks = (html: string): readonly string[] => [...html.matchAll(/<a\b[^>]*\bdata-vf-consent-settings\b[^>]*>([^<]*)<\/a>/gu)].map((m) => m[0]);

describe("#1185 R3/R4: the footer link and the island each page carries", () => {
  for (const lang of ["de", "en"] as const) {
    for (const p of pages(lang)) {
      it(`${lang}: ${p.name}, with a tag`, async () => {
        const html = await render(p, "G-TEST123");
        expect(all(html, ".site-head").length, p.path).toBeGreaterThan(0);
        const links = settingsLinks(html);
        expect(links.length, p.path).toBe(1);
        expect(links[0]).toContain(`href="${pathFor("datenschutz", lang)}#${PRIVACY_SETTINGS_ANCHOR}"`);
        expect(links[0]).toContain(`>${label(lang)}</a>`);
        // the link is the footer's
        const footer = html.slice(html.lastIndexOf("<footer"));
        expect(footer).toContain(links[0]);
        expect(islands(html), p.path).toEqual({ bar: p.island === "bar" ? 1 : 0, settings: p.island === "settings" ? 1 : 0 });
      });

      it(`${lang}: ${p.name}, without a tag: no link, no island`, async () => {
        const html = await render(p, undefined);
        expect(all(html, "footer").length, p.path).toBeGreaterThan(0);
        expect(html, p.path).not.toContain("data-vf-consent-settings");
        expect(islands(html), p.path).toEqual({ bar: 0, settings: 0 });
      });
    }
  }

  it("the Datenschutz page carries the anchor the link names (the fuel board's link lands on it)", async () => {
    const html = await render(pages("de")[3]!, "G-TEST123");
    expect([...html.matchAll(new RegExp(`\\sid="${PRIVACY_SETTINGS_ANCHOR}"`, "gu"))].length).toBe(1);
  });
});

describe("#1185 R4: the settings dialog loads nothing", () => {
  it("imports only the panel, the cookie expiry and the store, and names no tag, no Clarity and no script element", () => {
    const src = readFileSync(new URL("../src/components/ConsentSettings.svelte", import.meta.url), "utf8");
    const code = src.replace(/\/\*\*[\s\S]*?\*\//gu, "");
    const imports = [...code.matchAll(/^\s*import\b[^"]*"([^"]+)";$/gmu)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["../analytics/consent-store.js", "../analytics/ga-cookies.js", "./ConsentPanel.svelte", "svelte"]);
    expect(code).not.toMatch(/googletagmanager|clarity\.ms|gtag|dataLayer|createElement\(|loadClarity|startClarity|import\(/u);
  });
});

describe("#1185 R5: one panel for the bar and the dialog, its two buttons alike", () => {
  const panel = readFileSync(new URL("../src/components/ConsentPanel.svelte", import.meta.url), "utf8");
  it('decline first, then accept, both `class="btn"` and nothing else to tell them apart', () => {
    const buttons = [...panel.matchAll(/<button\b[^>]*>/gu)].map((m) => m[0]);
    expect(buttons.length).toBe(2);
    expect(buttons[0]).toContain('data-vf-consent="denied"');
    expect(buttons[1]).toContain('data-vf-consent="granted"');
    for (const b of buttons) {
      expect(b).toMatch(/\sclass="btn"/u);
      expect(b).not.toMatch(/style=|btn--/u);
    }
  });
  it("Escape is a refusal, never a consent", () => {
    const onKey = /function onKey\([^)]*\)[^{]*\{([\s\S]*?)\n  \}/u.exec(panel)?.[1] ?? "";
    expect(onKey).toContain('if (e.key === "Escape") onDecide("denied");');
    expect(onKey).not.toContain("granted");
  });
  it("both islands render the panel", () => {
    for (const f of ["Consent.svelte", "ConsentSettings.svelte"]) expect(readFileSync(new URL(`../src/components/${f}`, import.meta.url), "utf8"), f).toMatch(/<ConsentPanel\b/u);
  });
});
