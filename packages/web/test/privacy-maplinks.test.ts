/**
 * The Datenschutz paragraph on the map links (#944, data steward 2026-10-23,
 * condition 10), verbatim and in the "Website viafrei.de" section — the privacy
 * page is German and binding in every language (`layouts/Legal.astro`), so the
 * paragraph is German only. Each fact it states is held to the code that makes
 * it true.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAP_REL } from "@viafrei/design";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, REPO), "utf8");
const privacy = read("packages/web/src/components/LegalPrivacy.astro");

const PARAGRAPH =
  "Bei Einträgen mit Ortsangabe zeigen wir Links, die die Stelle bei OpenStreetMap, bei Google Maps, bei Apple Karten oder in der Karten-App Ihres Geräts öffnen. Welcher dieser Links erscheint, leitet unser Server allein aus der Browserkennung (User-Agent) Ihrer Anfrage ab (Android, iPhone/iPad oder anderes Gerät); diese Einordnung wird nicht protokolliert und keiner Person zugeordnet. Vor einem Klick besteht keine Verbindung zu diesen Anbietern. Erst wenn Sie einen solchen Link anklicken, ruft Ihr Gerät den jeweiligen Anbieter auf und übermittelt ihm dabei die Koordinaten oder die Adresse des Eintrags sowie, wie bei jedem Seitenaufruf, Ihre IP-Adresse und Browserkennung; die Adresse unserer Seite wird dabei nicht mitgesendet. Für die weitere Verarbeitung ist der jeweilige Anbieter verantwortlich; es gilt dessen Datenschutzerklärung. Rechtsgrundlage für die Auswahl des Links ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist, Ihnen den Ort in der passenden Karten-App anzubieten.";

describe("Datenschutz: the map links (#944, condition 10)", () => {
  it("the steward's paragraph, verbatim, once, inside 'Website viafrei.de'", () => {
    const at = privacy.indexOf('<p id="kartenlinks">');
    expect(at).toBeGreaterThan(privacy.indexOf("<h3>Website viafrei.de</h3>"));
    expect(at).toBeLessThan(privacy.indexOf("<h3>MCP-Endpunkt mcp.viafrei.de</h3>"));
    const p = privacy.slice(at, privacy.indexOf("</p>", at));
    expect(p.replace(/<p id="kartenlinks">/, "").replace(/\s+/g, " ").trim()).toBe(PARAGRAPH);
    expect(privacy.indexOf('id="kartenlinks"', at + '<p id="kartenlinks"'.length)).toBe(-1);
  });

  it("'keine eingebetteten Karten' stays true: a map link is a plain anchor, no map is embedded", () => {
    expect(privacy).toContain("keine eingebetteten Karten");
    const html = read("packages/design/src/map.ts");
    expect(html).not.toMatch(/<iframe|<img|<script/);
  });

  it("'die Adresse unserer Seite wird dabei nicht mitgesendet': every map link is noreferrer", () => {
    expect(MAP_REL.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer", "nofollow"]));
  });

  it("'diese Einordnung wird nicht protokolliert': no log line in the shell carries the platform", () => {
    for (const f of ["packages/web/src/middleware.ts", "packages/web/src/lib/log.ts", "packages/web/src/lib/fragment-cache.ts", "packages/web/src/lib/place.ts", "packages/web/src/lib/motorway.ts"]) {
      for (const call of read(f).match(/logLine\([^;]*\)|logFragmentFailure\([^;]*\)/g) ?? []) expect(call, f).not.toMatch(/mapPlatform|user-agent|userAgent/i);
    }
  });
});
