/**
 * The Datenschutz section "Fehlermeldungen unserer Dienste" (#741, data-steward
 * T12) is pinned to the mechanism it describes: every figure it states is the
 * figure the code enforces, so a change to one without the other goes red.
 * The text is the steward's of 2026-10-14, verbatim; the rendered page is
 * asserted in both analytics variants by `e2e/legal.e2e.ts`.
 *
 * Read as text (tests may read the register; the web runtime imports nothing
 * from the database-holding workspaces — check_web_boundary.sh). The collector,
 * the timer, the deploy and the backup are viafrei-infra's: the cases that read
 * them are skipped here and held by viafrei-infra.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGE_MAX_CHARS, STACK_MAX_BYTES } from "../src/lib/log-mask.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, REPO), "utf8");

const privacy = read("packages/web/src/components/LegalPrivacy.astro");
const start = privacy.indexOf('<h3 id="fehlermeldungen">');
const section = privacy.slice(start, privacy.indexOf('<h2 id="besucherzaehlung">', start));
/** viafrei-infra's collector (read only by the skipped cases). */
const collector = (): string => read("the host error collector");
// viafrei-web#2: migration 0132 as the pinned viafrei-database release carries it — squashed into its baseline
const migration = read(`.pinned/database/db/baseline/${readdirSync(new URL(".pinned/database/db/baseline/", REPO)).find((f) => f.endsWith("_baseline.sql")) ?? "missing"}`);

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
  });
  // cross-repo(viafrei-infra): the collector is viafrei-infra's
  it.skip("the collector enforces the same bounds", () => {
    expect(collector()).toContain(`message = bound(mask(message), ${String(MESSAGE_MAX_CHARS)})`);
    expect(collector()).toContain(`stack = bound(mask(stack), ${String(STACK_MAX_BYTES)})`);
  });
  it("states the thirty days the collector deletes after and the deploy gate checks", () => {
    expect(section).toContain("nach 30 Tagen automatisch gelöscht; bei jeder Bereitstellung prüfen wir, dass kein älterer Eintrag besteht.");
  });
  // cross-repo(viafrei-infra): the collector and the deploy gate are viafrei-infra's
  it.skip("the collector deletes after thirty days and the deploy gate checks", () => {
    expect(collector()).toContain("delete from error_events where hour < now() - interval '30 days';");
    expect(read("the deploy")).toMatch(/^error_events_retention_verdict$/m);
  });
  it("states the five minutes and the run before every update", () => {
    expect(section).toContain("alle fünf Minuten und vor jeder Aktualisierung");
  });
  // cross-repo(viafrei-infra): the timer and the deploy are viafrei-infra's
  it.skip("the collector runs every five minutes and before every update", () => {
    expect(read("the host collector unit")).toMatch(/OnUnitActiveSec=5min/);
    expect(read("the host collector unit")).toContain("the host error collector");
    expect(read("the deploy")).toContain("bash the host error collector");
  });
  it("leaves out the delivering web server", () => {
    expect(section).toContain("Die Protokolle des ausliefernden Webservers der Website (oben unter „Website viafrei.de“) gehören nicht dazu.");
  });
  // cross-repo(viafrei-infra): the collector is viafrei-infra's
  it.skip("the collector leaves out the delivering web server", () => {
    expect(collector()).toContain('EXCLUDED_CONTAINERS="viafrei-landing"');
  });
  it("says the backup leaves them out", () => {
    expect(section).toContain("nicht in die nächtliche Datensicherung aufgenommen");
  });
  // cross-repo(viafrei-infra): the backup is viafrei-infra's
  it.skip("the backup leaves them out", () => {
    expect(read("the backup job")).toContain("public.error_events");
  });
});
