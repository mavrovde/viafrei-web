/**
 * The Datenschutzerklärung's "Live-Abfragen bei Datenanbietern" paragraph
 * (launch audit F-22) is pinned to the code it describes: every MCP tool that
 * reaches a provider's port during a call is named in it, no tool is named that
 * does not, and the provider hosts it names are the ones the clients call. A
 * fourth live caller added to the server turns this red until the page says so.
 *
 * Read as text (tests may read the register; the web runtime imports nothing
 * from the database-holding workspaces — check_web_boundary.sh).
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pinnedPath } from "./pinned-source.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(pinnedPath(rel), REPO), "utf8");

const privacy = read("packages/web/src/components/LegalPrivacy.astro");
const start = privacy.indexOf('<h3 id="live-abfragen">');
const section = privacy.slice(start, privacy.indexOf("{", start));

/** The ports in `server/deps.ts` that reach a provider during a tool call. */
const LIVE_PORTS = ["trains", "facilities", "fuel"] as const;

function liveTools(): string[] {
  const dir = new URL(".pinned/app/packages/mcp/dist/src/tools/", REPO);
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".js") || f.endsWith(".test.js") || f.endsWith(".schema.js")) continue;
    const src = readFileSync(new URL(f, dir), "utf8");
    // The asked price refresh (#521) reaches the fuel port through the one
    // shared helper, `refreshBeforeRead(deps, …)`, so that call counts too.
    const calls = LIVE_PORTS.some((p) => new RegExp(`deps\\.${p}(\\?)?\\.(board|check|discover)\\(`, "u").test(src)) || /\brefreshBeforeRead\(deps\b/u.test(src);
    if (calls) out.push(f.replace(/\.js$/u, ""));
  }
  return out.sort();
}

const hostOf = (file: string, constant: string): string => {
  const m = new RegExp(`export const ${constant} = "(https://[^"/]+)`, "u").exec(read(file));
  if (m === null) throw new Error(`${constant} not found in ${file}`);
  return new URL(m[1]!).host;
};

describe("Datenschutz: live provider calls (F-22)", () => {
  it("the section exists and is German, before section 4", () => {
    expect(start).toBeGreaterThan(0);
    expect(section).toMatch(/Rechtsgrundlage:<\/strong> Art\. 6 Abs\. 1 lit\. f DSGVO/u);
    // Section 4 has carried an id since #535 (the visitor count): match the heading, not the tag.
    expect(privacy.search(/<h2[^>]*>4\./u)).toBeGreaterThan(start);
  });

  it("names exactly the tools that call a provider during a request", () => {
    const tools = liveTools();
    expect(tools).toEqual(["check_station_facilities", "find_cheapest_fuel", "find_fuel_station", "get_train_departures"]);
    const named = [...new Set([...section.matchAll(/<code>([a-z_]+)<\/code>/gu)].map((m) => m[1]))].sort();
    expect(named).toEqual(tools);
  });

  it("names the hosts the clients actually call", () => {
    expect(section).toContain(hostOf("packages/ingest/src/clients/tankerkoenig.ts", "TANKERKOENIG_BASE"));
    expect(section).toContain(hostOf("packages/ingest/src/clients/db-api.ts", "DB_API_BASE"));
  });

  it("says what is sent and what never is", () => {
    expect(section).toMatch(/Koordinaten dieses Ortes und den Suchradius/u);
    // The asked price refresh (#521): station ids, the nearest, at most ten, under our own key.
    expect(section).toMatch(/kann unser Server bei Tankerkönig/u);
    expect(section).toMatch(/aktuellen Preise der nächstgelegenen dieser Tankstellen abfragen — höchstens zehn je Frage und nur, wenn\s+deren Preis älter als 30 Minuten ist \(ein von uns einstellbarer Wert, nie unter fünf Minuten\)/u);
    expect(section).toMatch(/übermittelt werden\s+dafür allein deren Tankstellen-Kennungen/u);
    expect(section).toMatch(/unter eigener Kennung, mit unserem\s+eigenen Zugangsschlüssel/u);
    expect(section).toMatch(/Nummer des abgefragten Bahnhofs/u);
    expect(section).toMatch(/niemals der eingegebene\s+Text, Ihre IP-Adresse, eine\s+Sitzungskennung/u);
  });
});
