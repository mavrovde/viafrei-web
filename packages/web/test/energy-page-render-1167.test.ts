/**
 * #1167 S2 (data-steward ruling 2026-11-04) on the RENDERED page, in every live language, through Astro's container:
 * a fuel station's page carries NO JSON-LD at all — a station's name and address are MTS-K Grunddaten, and a WebPage
 * or breadcrumb node would carry the name too — while a charging site's page keeps its graph (a `Place`).
 *
 * The digest is a loopback stub (no database, no network) answering `/internal/fuel/<slug>` and
 * `/internal/charging/<slug>` with the digest's OWN renderer — the bytes the route sends.
 */
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { chargingPageKeyedSlug, fuelPageKeyedSlug } from "../../ingest/src/index.js";
import { renderChargingPage, renderFuelPage } from "../../digest/src/presentation/energy-page-html.js";
import type { ChargingPage, FuelPage } from "../../digest/src/server/energy-page-service.js";
import type { TileLang } from "../../digest/src/presentation/i18n.js";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FUEL_FILE = "/src/pages/[lang]/fuel/[slug].astro";
const CHARGING_FILE = "/src/pages/[lang]/charging/[slug].astro";
const NOW = new Date();

const FUEL_SLUG = fuelPageKeyedSlug({ id: "f-1167", brand: "Zapfwerk", name: "Zapfwerk Tankstelle", city: "Fulda", street: "Tankgasse" });
const CHARGING_SLUG = chargingPageKeyedSlug({ sourceFeed: "afir_chargecloud_stat", siteId: "S-1167", operator: "Stromwerk", name: "Ladepark", city: "Fulda", street: "Ladeweg" });

const fuelPage: FuelPage = {
  kind: "fuel",
  slug: FUEL_SLUG,
  row: { id: "f-1167", brand: "Zapfwerk", name: "Zapfwerk Tankstelle", street: "Tankgasse", house_no: "1", postcode: "36037", city: "Fulda", land: "HE", town_places: null, whole_day: true, lat: 50.5558, lon: 9.6808, day: "2026-11-02" },
  town: { ags: "06631009", name: "Fulda" },
  exit: null,
  near: [],
};
const chargingPage: ChargingPage = {
  kind: "charging",
  alternatives: [],
  slug: CHARGING_SLUG,
  row: { source_feed: "afir_chargecloud_stat", site_id: "S-1167", operator: "Stromwerk", name: "Ladepark", street: "Ladeweg", house_number: "3", postcode: "36037", city: "Fulda", lat: 50.5558, lon: 9.6808, day: "2026-11-02" },
  town: { ags: "06631009", name: "Fulda" },
  exit: null,
  site: { source_feed: "afir_chargecloud_stat", site_id: "S-1167", name: "Ladepark", operator: "Stromwerk", street: "Ladeweg", house_number: "3", city: "Fulda", metres: 0, points: 0, max_kw: 150, lat: 50.5558, lon: 9.6808, point_status: [] },
  liveness: { ok: true, value: [] },
};

let digest: Server | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;
const saved = process.env["DIGEST_URL"];

beforeAll(async () => {
  digest = createHttpServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    const lang = (u.searchParams.get("lang") ?? "de") as TileLang;
    const html =
      u.pathname === `/internal/fuel/${FUEL_SLUG}` ? renderFuelPage(lang, fuelPage, NOW) : u.pathname === `/internal/charging/${CHARGING_SLUG}` ? renderChargingPage(lang, chargingPage, NOW) : null;
    if (html === null) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end("<p>no</p>");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  await new Promise<void>((r) => digest!.listen(0, "127.0.0.1", () => r()));
  process.env["DIGEST_URL"] = `http://127.0.0.1:${String((digest.address() as AddressInfo).port)}`;
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  await vite.ssrLoadModule(FUEL_FILE);
  await vite.ssrLoadModule(CHARGING_FILE);
}, 30_000);

afterAll(async () => {
  await vite?.close();
  await new Promise<void>((r) => (digest === undefined ? r() : digest.close(() => r())));
  if (saved === undefined) delete process.env["DIGEST_URL"];
  else process.env["DIGEST_URL"] = saved;
});

const render = async (file: string, params: Record<string, string>, url: string, lang: Lang): Promise<string> => {
  const mod = (await vite!.ssrLoadModule(file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  return container.renderToString(mod.default, {
    params,
    request: new Request(url, { headers: { "accept-language": lang, "user-agent": "Mozilla/5.0" } }),
    locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
  });
};

describe("#1167 S2: a fuel station's page carries no JSON-LD; a charging site's keeps its graph", () => {
  for (const lang of LIVE_LANGS) {
    it(lang, async () => {
      const fuel = await render(FUEL_FILE, { lang, slug: FUEL_SLUG }, `${SITE_ORIGIN}/${lang}/fuel/${FUEL_SLUG}`, lang);
      expect(fuel, `${lang} fuel rendered`).toContain("energypage--fuel");
      expect(fuel, `${lang} fuel`).not.toContain("application/ld+json");
      expect(fuel, `${lang} fuel`).not.toMatch(/GasStation|"@context"/);
      const charging = await render(CHARGING_FILE, { lang, slug: CHARGING_SLUG }, `${SITE_ORIGIN}/${lang}/charging/${CHARGING_SLUG}`, lang);
      expect(charging, `${lang} charging rendered`).toContain("energypage--charging");
      expect(charging, `${lang} charging`).toContain("application/ld+json");
      expect(charging, `${lang} charging`).toContain('"@type":"Place"');
    });
  }
});

// #1187 (owner 2026-11-04: "switch between … fuel stations, the header loses my position"): a fuel STATION's page shares
// the board's page id but is not the board — its header carries the location island like every other page, so the
// visitor's remembered place stays on the pill. #1198 (owner 2026-11-06, "add the place script"): so does the board,
// which ran no script from v1.8.18 — still no analytics and no consent island there (`scripts/budget.ts`).
describe("#1187, #1198: a fuel station's page and the fuel board carry the header's island", () => {
  const ISLAND = '"server":{"source":"none","at":null,"label":null}';
  it("the fuel station's and the charging site's pages, in every language", async () => {
    for (const lang of LIVE_LANGS) {
      const fuel = await render(FUEL_FILE, { lang, slug: FUEL_SLUG }, `${SITE_ORIGIN}/${lang}/fuel/${FUEL_SLUG}`, lang);
      expect(fuel, `${lang} fuel`).toContain(ISLAND);
      const charging = await render(CHARGING_FILE, { lang, slug: CHARGING_SLUG }, `${SITE_ORIGIN}/${lang}/charging/${CHARGING_SLUG}`, lang);
      expect(charging, `${lang} charging`).toContain(ISLAND);
    }
  });
  it("the fuel board: the header's island, and no analytics (the nonce is the middleware's: e2e/place-pill-1198)", async () => {
    for (const lang of LIVE_LANGS) {
      const board = await render("/src/pages/[lang]/fuel.astro", { lang }, `${SITE_ORIGIN}/${lang}/fuel`, lang);
      expect(board, lang).toContain('id="place-pill"');
      expect(board, lang).toContain(ISLAND);
      expect(board, lang).not.toMatch(/googletagmanager|clarity\.ms|gtag\(|<astro-island\b|application\/ld\+json/);
    }
  });
});
