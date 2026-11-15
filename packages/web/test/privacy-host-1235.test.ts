/**
 * #1235: the Datenschutzerklärung names the new host — Hetzner Online GmbH,
 * with its address, the data centre in Germany (Falkenstein/Vogtland, FSN1)
 * and Art. 28 DSGVO — and keeps Contabo named until the old host's personal
 * data is deleted (data-steward ruling S4/S19 on #1232's copy set; the AVV of
 * #1276). Read as text: section 2 is unconditional and German in every
 * language, so every `/<lang>/datenschutz` route of the page map renders this
 * one component with no language branch (`Legal.astro`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf8");
const src = read("../src/components/LegalPrivacy.astro");
const layout = read("../src/layouts/Legal.astro");
const pageMap = read("../../../scripts/site-pages.txt");
const flat = (s: string): string => s.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ");
const start = src.indexOf("<h2>2. Hosting</h2>");
const end = src.indexOf('<h3 id="cloudflare">');
const hosting = flat(src.slice(start, end));

describe("#1235 the privacy page's host", () => {
  it("names Hetzner Online GmbH with its address as the Art. 28 processor, the server in Germany at Falkenstein", () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(hosting).toContain("Diese Seite wird auf einem Server der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, betrieben.");
    expect(hosting).toContain("Der Server steht in Deutschland (Rechenzentrum Falkenstein/Vogtland).");
    expect(hosting).toContain("in unserem Auftrag (Art. 28 DSGVO).");
  });

  it("keeps Contabo named as the former host, and claims no deletion yet", () => {
    expect(hosting).toContain("virtuellen Server der Contabo GmbH");
    expect(hosting).toContain("(Rechenzentrum Nürnberg)");
    expect(hosting).not.toMatch(/gelöscht/u);
    expect(hosting.indexOf("Hetzner")).toBeLessThan(hosting.indexOf("Contabo"));
  });

  it("stands outside any conditional branch", () => {
    expect(src.slice(start, end)).not.toMatch(/[{}]/u);
  });

  it("is rendered for every language route of the page map, with no language branch", () => {
    const routes = pageMap.split("\n").filter((l) => /^\/[a-z]{2}\/datenschutz\s/u.test(l));
    expect(routes.length).toBeGreaterThanOrEqual(7);
    expect(layout).toContain('{which === "datenschutz" && <LegalPrivacy ');
    expect(src).not.toMatch(/\blang\s*===/u);
  });
});
