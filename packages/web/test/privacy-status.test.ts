/**
 * The Datenschutz paragraph on status.viafrei.de and admin.viafrei.de (2.0.2),
 * since 2026-11-18 the record of their retirement: both hosts and the console
 * were removed that day (owner), and the section is the data steward's text of
 * that day, in the past tense. What stays true is the audit log: its rows are
 * kept, their addresses forgotten after twelve months by the schema's own
 * function, which the assertions below still read from the pinned database.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pinnedPath } from "./pinned-source.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(pinnedPath(rel), REPO), "utf8");
const flat = (s: string): string => s.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ");
const src = read("packages/web/src/components/LegalPrivacy.astro");
const sec = flat(src.slice(src.indexOf('<h3 id="statusseite">'), src.indexOf('<h3 id="live-abfragen">')));
// viafrei-web#2: migrations 0104 and 0111 as the pinned viafrei-database release carries them — squashed into its baseline
const baseline = readFileSync(new URL(`.pinned/database/db/baseline/${readdirSync(new URL(".pinned/database/db/baseline/", REPO)).find((f) => f.endsWith("_baseline.sql")) ?? "missing"}`, REPO), "utf8");

describe("the privacy notice on the retired status page and console (2.0.2, retired 2026-11-18)", () => {
  it("is there, inside section 3, under its old anchor, and names both hosts as retired", () => {
    expect(src.indexOf('<h3 id="statusseite">')).toBeGreaterThan(src.indexOf("<h2>3. Server-Logfiles</h2>"));
    expect(sec).toContain("Frühere Statusseite und Betriebskonsole (eingestellt am 18.11.2026)");
    expect(sec).toContain("Bis zum 18.11.2026 betrieben wir unter status.viafrei.de eine Statusseite und unter admin.viafrei.de eine Betriebskonsole; beide waren nur dem Betreiber zugänglich.");
    expect(sec).toContain("Beide Adressen sind abgeschaltet und ihre Einträge im Namensdienst gelöscht.");
    expect(sec).toContain("Cookies der Konsole (Anmeldung des Betreibers) werden nicht mehr gesetzt.");
  });

  it("names the two hosts nowhere else, so no other sentence calls them live", () => {
    // the rendered markup only: the frontmatter's comment keeps the hosts' history
    const markup = src.slice(src.indexOf("---", 3) + 3);
    const outside = flat(markup.replace(markup.slice(markup.indexOf('<h3 id="statusseite">'), markup.indexOf('<h3 id="live-abfragen">')), ""));
    expect(outside).not.toContain("status.viafrei.de");
    expect(outside).not.toContain("admin.viafrei.de");
    // section 3 counts two live addresses and points at the retired ones
    expect(outside).toContain("Dieses Angebot besteht aus zwei Adressen: der Website viafrei.de (auch www.viafrei.de) und dem MCP-Endpunkt mcp.viafrei.de");
    expect(outside).toContain("Die frühere Statusseite und Betriebskonsole sind eingestellt");
    expect(outside).not.toContain("vier Adressen");
    // the error events are read in the database, not in a console that no longer exists
    expect(outside).toContain("Die Einträge liest nur der Betreiber, unmittelbar in der Datenbank und nur lesend;");
    expect(outside).not.toContain("Betriebskonsole zugänglich");
    expect(outside).not.toContain("der Statusseite und Betriebskonsole, der Datenbank");
    // nothing describes the live console's cookies, its refusal or a visitor's view of it any more
    expect(src).not.toContain("__Host-vf_console");
    expect(src).not.toContain("__Host-vf_passkey");
    expect(src).not.toContain("ohne Inhalt abgewiesen");
    expect(src).not.toContain("viafrei.status.mode");
    expect(src).not.toContain("Für die Statusseite status.viafrei.de");
  });

  it("says visitors of the site and the MCP endpoint were never recorded there", () => {
    expect(sec).toContain("Besucher der Website viafrei.de und des MCP-Endpunkts wurden in der Konsole nie erfasst");
    expect(sec).toContain("für den Aufruf der Statusseite haben wir kein Zugriffsprotokoll geschrieben");
  });

  it("the kept audit log's addresses are deleted after twelve months (#692): the page says so", () => {
    expect(sec).toContain("Erhalten bleibt das Prüfprotokoll der Konsole.");
    expect(sec).toContain(
      "Es kann nachträglich nicht geändert werden, mit einer Ausnahme: Zwölf Monate nach einem Eintrag wird dessen IP-Adresse automatisch gelöscht; der Eintrag bleibt danach ohne IP-Adresse erhalten und lässt sich keiner Person außer dem Betreiber mehr zuordnen. In unseren nächtlichen Datensicherungen ist die Adresse noch enthalten, bis die jeweilige Sicherung im regelmäßigen Wechsel gelöscht wird; wir bewahren nur die sieben jüngsten Sicherungen auf.",
    );
    expect(sec).toContain("Zum Zeitpunkt dieser Erklärung enthält das Prüfprotokoll keine Einträge.");
  });

  // cross-repo(viafrei-infra): the backup and rollup jobs are viafrei-infra's
  it.skip("the audit log's addresses are deleted after twelve months (#692): the backup job keeps seven, the rollup job runs the forget", () => {});

  it("the audit log's addresses are deleted after twelve months (#692): the pinned database's schema says so", () => {
    // the exception admits client_ip := NULL on rows older than twelve months, and nothing else
    expect(baseline).toContain("old.at < now() - interval '12 months'");
    expect(baseline).toContain("new.client_ip is null");
    expect(baseline).toMatch(/set client_ip = null\s+where client_ip is not null\s+and at < now\(\) - interval '12 months'/);
  });

  it("the audit log cannot be changed and names the operator's address — and the pinned database's schema says so", () => {
    expect(sec).toContain("Es kann nachträglich nicht geändert werden");
    expect(sec).toContain("die IP-Adresse des Betreibers, von der die Anfrage kam; es betrifft nur Handlungen des Betreibers (Art. 6 Abs. 1 lit. f DSGVO");
    expect(baseline).toMatch(/^CREATE TRIGGER ops_audit_append_only BEFORE DELETE OR UPDATE ON public\.ops_audit FOR EACH ROW EXECUTE FUNCTION public\.ops_audit_append_only\(\);$/mu);
    const table = baseline.slice(baseline.indexOf("CREATE TABLE public.ops_audit ("), baseline.indexOf(");", baseline.indexOf("CREATE TABLE public.ops_audit (")));
    expect(table).toMatch(/^ {4}client_ip text,$/mu);
  });
});
