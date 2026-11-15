/**
 * The nearest-stations card (#693) is one of the home's place cards: the home
 * of a visitor whose address the GeoIP file places in Köln holds it in its
 * first HTML, rendered by the REAL digest (`e2e/real-digest.ts`, the
 * production renderer over a fixture round), and so does the place page's
 * fragment — in every language, before the everyday cards it precedes, and
 * with the lift outages of its stations folded in rather than on a lifts card
 * of their own. The nearby-places card (#693, OpenStreetMap) rides on the
 * same fragment.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, parse, text as nodeText } from "@viafrei/design/testing";
import { startRealDigest } from "../e2e/real-digest.js";
import { fetchPlace } from "../src/lib/place.js";
import { openGeoIp, type GeoIp } from "../src/location/geoip.js";
import { homePlace } from "../src/location/server.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

let digest: Awaited<ReturnType<typeof startRealDigest>>;
let dir = "";
let geo: GeoIp | null = null;

beforeAll(async () => {
  digest = await startRealDigest();
  dir = mkdtempSync(join(tmpdir(), "vf-stations-geo-"));
  execFileSync("node", [join(ROOT, "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", join(dir, "geoip.vfgeo"), "--min-de-ranges", "1"], { input: readFileSync(join(HERE, "fixtures", "geoip-fixture.csv")), encoding: "utf8" });
  geo = openGeoIp(join(dir, "geoip.vfgeo"));
});
afterAll(async () => {
  geo?.close();
  rmSync(dir, { recursive: true, force: true });
  await digest?.close();
});

const cardIds = (html: string): string[] => [...html.matchAll(/<article class="pcard[^"]*" id="pcard-([a-z]+)"/g)].map((m) => m[1] ?? "");

describe("the home's place cards carry the nearest stations (#693)", () => {
  it("the first HTML of a Köln visitor's home holds the stations card, live departures and all", async () => {
    const req = { get: (n: string): string | null => (n === "x-forwarded-for" ? "192.0.2.77" : n === "user-agent" ? "Mozilla/5.0" : null) };
    const home = await homePlace(req, "de", { baseUrl: digest.url, timeoutMs: 2000, geoipFile: undefined, geo });
    expect(home.source).toBe("ip");
    const html = home.place?.html ?? "";
    expect(cardIds(html)).toContain("stations");
    const card = /<article class="pcard[^"]*" id="pcard-stations"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
    expect(all(card, "span[translate=\"no\"]").map(nodeText)).toContain("Köln Hbf");
    expect(card).toContain("fällt aus"); // the fixture's cancelled RE7
    expect(card).toContain("Echtzeitdaten: DELFI e.V.");
    // its stations' lifts are on the card, and no lifts card lists them again
    expect(card).toContain('<span class="pcard__sub pcard__fac">Aufzüge: 5 von 6 in Betrieb · Fahrtreppen: 6 von 6 in Betrieb · Parkhaus oder Parkplatz <span translate="no">Parkhaus Dom</span> (200 m, 520 Plätze)');
    // #1147: the facts are one closed disclosure whose summary says what is out of service; the units list is inside it
    expect(all(card, "summary.pcard__moresum").map(nodeText)).toContain("Ausstattung · Aufzüge: 1 außer Betrieb");
    expect(all(card, "details.pcard__more p.pcard__note").map(nodeText)).toContain("Alle Anlagen (12)");
    expect(nodeText(parse(card).root)).toContain("außer Betrieb: Aufzug zu Gleis 4/5");
    expect(all(card, "strong").map(nodeText)).toContain("außer Betrieb:");
    expect(all(card, "span[lang=\"de\"]").map(nodeText)).toContain("zu Gleis 4/5");
    expect(cardIds(html)).not.toContain("lifts");
  });

  it("the same home holds the health card (#1117): the nearest pharmacy with its walk, the OSM line and the offer", async () => {
    const req = { get: (n: string): string | null => (n === "x-forwarded-for" ? "192.0.2.77" : n === "user-agent" ? "Mozilla/5.0" : null) };
    const home = await homePlace(req, "de", { baseUrl: digest.url, timeoutMs: 2000, geoipFile: undefined, geo });
    const html = home.place?.html ?? "";
    expect(cardIds(html)).toEqual(expect.arrayContaining(["groceries", "health", "money", "police", "toilets"]));
    const card = /<article class="pcard[^"]*" id="pcard-health"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
    expect(nodeText(parse(card).root)).toContain("Apotheke Dom-Apotheke");
    expect(all(card, "span.pcard__need").map(nodeText)).toContain("Apotheke");
    expect(all(card, "span[translate=\"no\"]").map(nodeText)).toContain("Dom-Apotheke");
    expect(all(card, "span.pcard__stop").map(nodeText)).toContain("Dom-Apotheke");
    expect(card).toContain("Min. zu Fuß");
    // two inside the 2 km of its own: widened to the kilometre that reaches a third, or the widest when there is none
    expect(card).toContain("Wenige in der Nähe – die nächsten im Umkreis von 5,0 km, laut OpenStreetMap");
    expect(html).toContain("Keine Unterkunft im Umkreis von 5,0 km in den OpenStreetMap-Daten.");
    expect(card).toContain("OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0");
    expect(all(card, "a[href=\"/impressum\"]").map(nodeText)).toContain("Impressum");
  });

  for (const lang of LIVE_LANGS) {
    it(`${lang}: the place fragment lists the stations card before the everyday cards`, async () => {
      const place = await fetchPlace("ags:05315000", lang, { baseUrl: digest.url, timeoutMs: 2000 });
      const ids = cardIds(place?.html ?? "");
      expect(ids, lang).toContain("stations");
      expect(ids, lang).toContain("health");
      for (const later of ["charging", "fuel", "parking"]) if (ids.includes(later)) expect(ids.indexOf("stations"), `${lang}: before ${later}`).toBeLessThan(ids.indexOf(later));
    });
  }
});
