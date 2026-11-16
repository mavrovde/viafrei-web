/**
 * The language menu's summary names itself by its visible badge first (WCAG 2.5.3 label in name, axe-core 4.14's
 * label-content-name-mismatch): "DE – Sprache wählen: Deutsch". Rendered for every live language, because the badge is
 * the locale's own (`badgeOf`: uk → UA), and judged against the summary's own visible text.
 */
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { all, decode, text as nodeText } from "@viafrei/design/testing";
import { badgeOf } from "../src/i18n/locales.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
let vite: ViteDevServer | undefined;
let container: AstroContainer;
let List: Parameters<AstroContainer["renderToString"]>[0];

beforeAll(async () => {
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  List = ((await vite.ssrLoadModule("/src/components/LanguageList.astro")) as { default: typeof List }).default;
}, 30_000);

afterAll(async () => {
  await vite?.close();
});

describe("the language menu's summary: its name begins with its visible badge (WCAG 2.5.3)", () => {
  it("covers all 22 live languages", () => {
    expect(LIVE_LANGS.length).toBe(22);
  });

  it.each(LIVE_LANGS)("%s", async (lang) => {
    const html = await container.renderToString(List, { props: { lang, page: "start", variant: "menu" } });
    const summary = all(html, "summary.langmenu__summary");
    expect(summary.length, lang).toBe(1);
    const name = decode(summary[0]!.attrs["aria-label"] ?? "");
    expect(name.startsWith(`${badgeOf(lang)} – `), `${lang}: ${name}`).toBe(true);
    expect(decode(nodeText(summary[0]!)).trim(), `${lang}: the visible text is the badge`).toBe(badgeOf(lang));
  });
});
