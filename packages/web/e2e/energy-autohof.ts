/**
 * #1076 AC "Page budget (500 KB / 200 KB gzip) on the biggest site (a motorway Autohof with 20+ charge points)": the
 * heaviest station pages the digest can render, planted for the page-weight gate (`scripts/budget.ts`) and the shell's
 * fixture digest (`e2e/real-digest.ts`).
 *
 * The charging site is an Autohof hub of `AUTOHOF_POINTS` charge points — more than the page lists one by one
 * (`ENERGY_POINTS_SHOWN`), so the table is at its longest and the "+N" line is printed — every point with four plug
 * types, its power and a FRESH live status (a state word in every cell, the longest a cell gets), a long operator and
 * site name, a street, a town and the nearest junction (no fuel station: a charging page names none, #1167 S3). The
 * fuel station beside it carries the junction, the town and three nearby charging sites. Both are rendered by the digest's
 * OWN renderer (`renderChargingPage` / `renderFuelPage`) behind its own routes; only the page service is planted.
 */
import { chargingPageKeyedSlug, fuelPageKeyedSlug } from "@viafrei/ingest";
import type { ChargingPage, EnergyPageService, FuelPage } from "../../digest/src/server/energy-page-service.js";
import type { ChargingPointSqlJson } from "../../digest/src/cards/shared/sql-charging.js";
import { ENERGY_POINTS_SHOWN } from "../../digest/src/presentation/energy-page-html.js";
import { failed } from "../../digest/src/queries/read-result.js";

/** The hub's charge points: well past 20 (the AC's "20+") and past the page's one-by-one list. */
export const AUTOHOF_POINTS = ENERGY_POINTS_SHOWN + 20;

const AT = { lat: 49.7425, lon: 10.1467 };
const OPERATOR = "Autohof Kitzingen Schnellladepark Betriebsgesellschaft mbH & Co. KG";
const SITE_NAME = "Schnellladepark am Autohof Kitzingen-Schwarzach, Nord- und Südseite";
const STREET = "Gewerbegebiet an der Bundesautobahn A 3 Würzburg–Nürnberg";
const FEED = "afir_chargecloud_stat";

export const AUTOHOF_CHARGING_SLUG = chargingPageKeyedSlug({ sourceFeed: FEED, siteId: "AUTOHOF-KT-1", operator: OPERATOR, name: SITE_NAME, city: "Kitzingen", street: STREET });
export const AUTOHOF_FUEL_SLUG = fuelPageKeyedSlug({ id: "autohof-kt-fuel", brand: "Autohof Kitzingen Tankstelle", name: "Autohof Kitzingen-Schwarzach Tank- und Rastanlage", city: "Kitzingen", street: STREET });

const EXIT = { road: "A3", junction_no: "74", name: "Kitzingen-Schwarzach", metres: 650 };
const TOWN = { ags: "09675139", name: "Kitzingen" };

function points(now: Date): ChargingPointSqlJson[] {
  const states = ["AVAILABLE", "OCCUPIED", "OUTOFORDER", "AVAILABLE"];
  const at = new Date(now.getTime() - 60_000).toISOString();
  return Array.from({ length: AUTOHOF_POINTS }, (_, i) => ({
    statusFeed: "afir_chargecloud_dyn",
    status: states[i % states.length]!,
    operationStatus: null,
    openingStatus: null,
    observedAt: at,
    feedTs: at,
    lastUpdated: null,
    exchangeProtocol: "snapshotPull",
    maxPowerKw: i % 3 === 0 ? 400 : i % 3 === 1 ? 150 : 22,
    connectorTypes: ["iec62196T2COMBO", "chademo", "iec62196T2", "domesticF"],
  }));
}

export function autohofChargingPage(now: Date): ChargingPage {
  const pts = points(now);
  return {
    kind: "charging",
    alternatives: [],
    slug: AUTOHOF_CHARGING_SLUG,
    row: { source_feed: FEED, site_id: "AUTOHOF-KT-1", operator: OPERATOR, name: SITE_NAME, street: STREET, house_number: "1", postcode: "97318", city: "Kitzingen", lat: AT.lat, lon: AT.lon, day: "2026-10-02" },
    town: TOWN,
    exit: EXIT,
    site: { source_feed: FEED, site_id: "AUTOHOF-KT-1", name: SITE_NAME, operator: OPERATOR, street: STREET, house_number: "1", city: "Kitzingen", metres: 0, points: pts.length, max_kw: 400, lat: AT.lat, lon: AT.lon, point_status: pts },
    liveness: { ok: true, value: [] },
  };
}

export const autohofFuelPage = (): FuelPage => ({
  kind: "fuel",
  slug: AUTOHOF_FUEL_SLUG,
  row: { id: "autohof-kt-fuel", brand: "Autohof Kitzingen Tankstelle", name: "Autohof Kitzingen-Schwarzach Tank- und Rastanlage", street: STREET, house_no: "1", postcode: "97318", city: "Kitzingen", land: "BY", town_places: null, whole_day: true, lat: AT.lat, lon: AT.lon, day: "2026-10-02" },
  town: TOWN,
  exit: EXIT,
  near: [1, 2, 3].map((i) => ({ slug: chargingPageKeyedSlug({ sourceFeed: FEED, siteId: `near-${String(i)}`, operator: OPERATOR, name: SITE_NAME, city: "Kitzingen", street: `${STREET} ${String(i)}` }), label: `${OPERATOR}, ${STREET} ${String(i)}`, metres: 90 * i, source_feed: FEED })),
});

/** The page service of the fixture digest: the two Autohof pages, nothing else (no prices: the budget weighs the first HTML). */
export function autohofEnergy(now: () => Date): EnergyPageService {
  return {
    fuel: (s) => Promise.resolve({ ok: true, value: s === AUTOHOF_FUEL_SLUG ? { kind: "page", page: autohofFuelPage() } : { kind: "missing" } }),
    charging: (s) => Promise.resolve({ ok: true, value: s === AUTOHOF_CHARGING_SLUG ? { kind: "page", page: autohofChargingPage(now()) } : { kind: "missing" } }),
    fuelPrices: () => Promise.resolve({ ok: true, value: { kind: "missing" } }),
    // the fixture holds no sitemap list: a failed read (the shell's 503), never an empty list that would read as "no pages"
    list: () => Promise.resolve(failed("the Autohof fixture holds no sitemap list")),
    counters: () => ({ reads: 0, listHits: 0, failures: 0, collisions: 0 }),
  };
}
