/**
 * The Datenschutz section "Fehlermeldungen unserer Dienste" (#741, data-steward
 * T12) is pinned to the mechanism it describes: every figure it states is the
 * figure the code enforces, so a change to one without the other goes red.
 * The text is the steward's of 2026-10-14, verbatim; the rendered page is
 * asserted in both analytics variants by `e2e/legal.e2e.ts`.
 *
 * Read as text (tests may read the register; the web runtime imports nothing
 * from the database-holding workspaces — check_web_boundary.sh).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGE_MAX_CHARS, STACK_MAX_BYTES } from "../src/lib/log-mask.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, REPO), "utf8");

const privacy = read("packages/web/src/components/LegalPrivacy.astro");
const start = privacy.indexOf('<h3 id="fehlermeldungen">');
const section = privacy.slice(start, privacy.indexOf('<h2 id="besucherzaehlung">', start));
const collector = read("the host error collector");
const migration = read("db/migrations/0132_error_events.sql");

describe("Fehlermeldungen unserer Dienste (#741 T12)", () => {
  it("exists once, at the end of section 3, and the MCP paragraph points at it", () => {
    expect(start).toBeGreaterThan(privacy.indexOf('<h3 id="live-abfragen">'));
    expect(privacy.indexOf('<h3 id="fehlermeldungen">', start + 1)).toBe(-1);
    expect(privacy).toContain("eine Sicherung oder Archivierung findet nicht statt.\n    Ausgenommen sind allein die darin enthaltenen Warn- und Fehlermeldungen: Sie übernehmen wir zuvor bereinigt in unsere Datenbank, wie unter");
  });
  it("states the bounds the mask and the table enforce", () => {
    expect(section).toContain(`auf ${String(MESSAGE_MAX_CHARS)} Zeichen gekürzter Meldungstext`);
    expect(STACK_MAX_BYTES).toBe(2048);
    expect(section).toContain("auf 2 KB gekürzter technischer Ablaufbericht");
    expect(migration).toContain(`char_length(message) <= ${String(MESSAGE_MAX_CHARS)}`);
    expect(migration).toContain(`octet_length(stack_sample) <= ${String(STACK_MAX_BYTES)}`);
    expect(collector).toContain(`message = bound(mask(message), ${String(MESSAGE_MAX_CHARS)})`);
    expect(collector).toContain(`stack = bound(mask(stack), ${String(STACK_MAX_BYTES)})`);
  });
  it("states the thirty days the collector deletes after and the deploy gate checks", () => {
    expect(section).toContain("nach 30 Tagen automatisch gelöscht; bei jeder Bereitstellung prüfen wir, dass kein älterer Eintrag besteht.");
    expect(collector).toContain("delete from error_events where hour < now() - interval '30 days';");
    expect(read("the deploy")).toMatch(/^error_events_retention_verdict$/m);
  });
  it("states the five minutes and the run before every update", () => {
    expect(section).toContain("alle fünf Minuten und vor jeder Aktualisierung");
    expect(read("the host collector unit")).toMatch(/OnUnitActiveSec=5min/);
    expect(read("the host collector unit")).toContain("the host error collector");
    expect(read("the deploy")).toContain("bash the host error collector");
  });
  it("leaves out the delivering web server, as the collector does", () => {
    expect(section).toContain("Die Protokolle des ausliefernden Webservers der Website (oben unter „Website viafrei.de“) gehören nicht dazu.");
    expect(collector).toContain('EXCLUDED_CONTAINERS="viafrei-landing"');
  });
  it("says the backup leaves them out, as the backup does", () => {
    expect(section).toContain("nicht in die nächtliche Datensicherung aufgenommen");
    expect(read("the backup job")).toContain("public.error_events");
  });
});
