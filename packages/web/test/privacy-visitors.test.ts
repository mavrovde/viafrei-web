/**
 * The Datenschutzerklärung's visitor-count text (#535) is the data-steward's
 * text of 2026-10-11, and it ships with the mechanism it describes (ruling
 * C10). Each claim the text makes is pinned to the file that makes it true:
 * the seven days to the rotation script and the deploy gate, the GPC/DNT
 * fields to the nginx log format (all three viafrei-infra's, so that case is
 * skipped here), the /64 and the HMAC to the counter. Read as
 * text (tests may read the register; the web runtime imports nothing from the
 * database-holding workspaces — check_web_boundary.sh).
 *
 * And C1: the count ships nothing into this package — no script, no beacon,
 * no Client Hints request — so a web runtime file that names it fails here.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { PAGES_PER_VISIT_BUCKETS, SEARCH_ENGINES, SITE_VISIT_DEVICES } from "../../../.pinned/app/packages/ingest/dist/platform/site-visits.js";
import { pinnedPath } from "./pinned-source.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(pinnedPath(rel), REPO), "utf8");
const flat = (s: string): string => s.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ");

const src = read("packages/web/src/components/LegalPrivacy.astro");
const text = flat(src);
const s4 = src.indexOf('<h2 id="besucherzaehlung">4. Besucherzählung ohne Cookies</h2>');
const box = src.indexOf('<section class="legal__box" id="widerspruch-besucherzaehlung"');

describe("section 3 of the privacy notice (T1)", () => {
  it("lists the two objection signals among the logged fields, and the count among the purposes", () => {
    expect(text).toContain("die Signale „Global Privacy Control“ (Sec-GPC) und „Do Not Track“ (DNT), sofern Ihr Browser sie sendet.");
    expect(text).toContain("missbräuchlichen Zugriffen — sowie die unter Punkt 4 beschriebene Besucherzählung.");
  });

  it("names seven days and no longer a size-bounded buffer for the website", () => {
    // #591: the wording matches the rotation (deletes on the seventh day, catches up after a restart) and the gate (7 days + 1 hour)
    expect(text).toContain("Speicherdauer: Die Zugriffs- und Fehlerprotokolle werden jede Nacht um Mitternacht (deutsche Zeit) in eine neue Datei geschrieben, und jede Datei wird am siebten Tag danach automatisch gelöscht. War der Webserver zu diesem Zeitpunkt nicht in Betrieb, wird die Löschung beim nächsten Start nachgeholt; bei jeder Bereitstellung prüfen wir außerdem, dass kein Eintrag älter als sieben Tage und eine Stunde ist. Es gibt keine Sicherung und keine Archivierung dieser Protokolle; ältere Einträge existieren nirgends mehr.");
    expect(text).not.toContain("spätestens sieben Tagen");
    const website = flat(src.slice(src.indexOf("<h3>Website viafrei.de</h3>"), src.indexOf("<h3>MCP-Endpunkt mcp.viafrei.de</h3>")));
    expect(website).not.toContain("rotierenden Puffer");
    expect(website).not.toContain("hängt allein vom Zugriffsaufkommen ab");
  });

  // cross-repo(viafrei-infra): the log rotation, its deploy gate and the edge's log format are viafrei-infra's
  it.skip("says seven days because the rotation deletes on day seven and the deploy fails past seven days and an hour", () => {});
});

describe("section 4, Besucherzählung ohne Cookies (T2)", () => {
  it("sits between section 3 and section 5, in both variants of the page", () => {
    expect(s4).toBeGreaterThan(src.indexOf("<h2>3. Server-Logfiles</h2>"));
    expect(s4).toBeLessThan(src.indexOf("!analytics &&"));
    expect(all(src, "h2").map(nodeText)).toContain("5. Kein Tracking, keine Drittanbieter");
    expect(all(src, "h2").map(nodeText)).toContain("5. Google Analytics — nur mit Ihrer Einwilligung");
    for (const [n, h] of [[6, "Kontaktaufnahme per E-Mail"], [7, "Ihre Rechte"], [8, "Beschwerderecht bei der Aufsichtsbehörde"], [9, "Anbieterangaben"]] as const) {
      expect(all(src, "h2").map(nodeText)).toContain(`${String(n)}. ${h}`);
    }
  });

  it("carries the steward's text, verbatim where it states a fact about the mechanism", () => {
    const sec = flat(src.slice(s4, box));
    for (const sentence of [
      "Auf Ihrem Gerät wird dafür nichts gespeichert und nichts ausgelesen: kein Cookie, kein lokaler Speicher, kein Zählpixel, kein Skript.",
      "bildet ein Programm aus der IP-Adresse (bei IPv6 nur aus deren ersten 64 Bit) und der Browserkennung einen kryptografischen Prüfwert (HMAC-SHA-256).",
      "Der Schlüssel dafür wird für jeden Kalendertag neu und zufällig erzeugt, nur im Arbeitsspeicher gehalten und nach der Auswertung des Tages verworfen; er wird nie gespeichert.",
      "Wer an zwei Tagen kommt, wird an beiden Tagen gezählt.",
      // #1185 (ruling 2026-11-04): the visits, the marginals, the hours and the automated filter, verbatim
      "Aufrufe mit demselben Prüfwert, zwischen denen höchstens 30 Minuten liegen, zählen wir als einen Besuch; ein Besuch endet spätestens mit dem Kalendertag.",
      "Was gespeichert wird: ausschließlich Summen. Je Tag: die Zahl der Besucher und der Besuche; wie viele Besuche 1, 2, 3, 4–5, 6–10 oder mehr als 10 Seiten umfassten; die Zahl der Seitenaufrufe je Seite und Sprache (auf den Autobahnseiten je Autobahn); die Zahl der Besuche je Einstiegsseite, je verweisender Domain (etwa „google.com“, ohne Pfad und ohne Suchbegriffe; eine Domain, von der an einem Tag weniger als drei Besuche kamen, nur als „sonstige“) und je Suchmaschine; die Zahl der Seitenaufrufe je Geräteklasse (Desktop, Mobilgerät, Tablet oder „sonstige“, wenn keine dieser drei erkennbar ist). Je Stunde nur die Gesamtzahl der Besuche und der Seitenaufrufe. Keine dieser Summen wird nach einer anderen aufgeschlüsselt. Die Geräteklasse wird aus der Browserkennung abgeleitet; die Kennung selbst wird nicht gespeichert. Eine IP-Adresse, eine Zeile je Besucher oder je Besuch oder ein Nutzungsprofil gibt es in dieser Statistik nicht.",
      "Automatische Abrufe: Aufrufe durch Suchmaschinen und andere automatische Programme werden herausgefiltert – Programme, die sich in ihrer Browserkennung als solche zu erkennen geben, und Abrufe, die an diesem Tag keine der zur Darstellung der Seite nötigen Dateien laden oder nach Häufigkeit und Muster einem automatischen Abruf entsprechen. Diese Einordnung geschieht nur während der Auswertung im Arbeitsspeicher; gespeichert wird nur die Zahl der so herausgefilterten Aufrufe je Tag. Dafür wird weder eine Adressliste geführt noch eine Adresse nachgeschlagen.",
      "Die Auswertung ist eine Weiterverarbeitung der unter Punkt 3 erhobenen Daten zu einem damit vereinbaren Zweck (Art. 6 Abs. 4 DSGVO).",
      "Die Tages- und Stundensummen lassen keinen Rückschluss auf einzelne Personen zu und werden unbefristet aufbewahrt.",
      "auch Google Analytics erhält aus dieser Zählung nichts.",
    ]) {
      expect(sec, sentence).toContain(sentence);
    }
  });

  it("names every device class the counter stores — four since #591", () => {
    expect(SITE_VISIT_DEVICES).toEqual(["desktop", "mobile", "tablet", "other"]);
    expect(text).toContain("Geräteklasse (Desktop, Mobilgerät, Tablet oder „sonstige“");
  });

  it("is true of the counter: HMAC-SHA-256, a 32-byte key per day, IPv6 /64", () => {
    const counter = read("packages/ingest/src/platform/site-visits.ts");
    expect(counter).toContain('createHmac("sha256", key)');
    expect(counter).toMatch(/key\.length !== 32/u);
    expect(counter).toContain("::/64");
    expect(read("packages/ingest/src/cli/site-visits.ts")).toContain("randomBytes(32)");
  });

  it("puts the objection in a box of its own, with its own heading, after the section's last paragraph (Art. 21(4))", () => {
    expect(box).toBeGreaterThan(s4);
    const b = src.slice(box, src.indexOf("</section>", box));
    expect(all(b, "h3[id=\"widerspruch-besucherzaehlung-h\"]").map(nodeText)).toContain("Ihr Widerspruchsrecht (Art. 21 DSGVO)");
    expect(flat(b)).toContain("Sendet Ihr Browser das Signal „Global Privacy Control“ (Sec-GPC: 1) oder „Do Not Track“ (DNT: 1), werden Ihre Aufrufe nicht gezählt");
    expect(flat(b)).toContain("lässt sich ein Widerspruch technisch nur über eines dieser Signale umsetzen");
    expect(read("packages/web/src/styles/site.css")).toMatch(/\.legal__box \{[^}]*border:/u);
  });

  it("points to the box from 'Ihre Rechte'", () => {
    expect(text).toContain("(Art. 21 DSGVO) — zur Besucherzählung siehe den Hinweis zum Widerspruch unter Punkt 4.");
    expect(all(src, "a[href=\"#widerspruch-besucherzaehlung\"]").length).toBeGreaterThan(0);
  });
});

describe("#1185 V10: the numbers the text says are the code's constants", () => {
  const counter = read("packages/ingest/src/platform/site-visits.ts");
  const store = read("packages/web/src/analytics/consent-store.ts");
  const sec4 = flat(src.slice(s4, box));

  it("30 minutes: the visit gap", () => {
    expect(counter).toMatch(/^export const VISIT_GAP_MS = 30 \* 60_000;$/mu);
    expect(sec4).toContain("zwischen denen höchstens 30 Minuten liegen, zählen wir als einen Besuch");
  });

  it("the pages-per-visit buckets, in the text's order", () => {
    expect(PAGES_PER_VISIT_BUCKETS).toEqual(["1", "2", "3", "4-5", "6-10", "11+"]);
    expect(sec4).toContain("wie viele Besuche 1, 2, 3, 4–5, 6–10 oder mehr als 10 Seiten umfassten");
  });

  it("three: the referrer threshold", () => {
    expect(counter).toMatch(/^export const REFERRER_MIN_VISITS = 3;$/mu);
    expect(sec4).toContain("eine Domain, von der an einem Tag weniger als drei Besuche kamen, nur als „sonstige“");
  });

  it("the closed list of search engines, the same in the counter, the pinned database's schema and the console's schema", () => {
    const engines = ["google", "bing", "duckduckgo", "ecosia", "qwant", "startpage", "yahoo", "yandex", "baidu"];
    expect(SEARCH_ENGINES).toEqual(engines);
    // migration 0256 as the pinned viafrei-database release carries it — squashed into its baseline
    const migration = read(`.pinned/database/db/baseline/${readdirSync(new URL(".pinned/database/db/baseline/", REPO)).find((f) => f.endsWith("_baseline.sql")) ?? "missing"}`);
    expect(migration).toContain(`CHECK ((engine = ANY (ARRAY[${[...engines, "other"].map((e) => `'${e}'::text`).join(", ")}])))`);
    expect(read("packages/status/src/presentation/schema.ts")).toContain(`z.enum([${[...engines, "other"].map((e) => `"${e}"`).join(", ")}])`);
  });

  it("180 days and twelve months: the two intervals of the stored decision (R1)", () => {
    expect(store).toMatch(/^export const REFUSAL_DAYS = 180;$/mu);
    expect(store).toMatch(/^export const CONSENT_DAYS = 365;$/mu);
    expect(text).toContain("Eine Einwilligung gilt zwölf Monate, eine Ablehnung sechs Monate (180 Tage); danach fragen wir Sie beim nächsten Aufruf einer Inhaltsseite erneut, nie früher");
    expect(text).toContain("Lehnen Sie ab, bleibt es dabei — auch bei jedem späteren Aufruf, bis wir Sie frühestens nach sechs Monaten noch einmal fragen.");
  });

  it("the storage paragraph is the ruling's, carries the settings anchor, and names the footer link by its label", () => {
    expect(store).toContain('export const PRIVACY_SETTINGS_ANCHOR = "datenschutz-einstellungen";');
    expect(all(src, "p#datenschutz-einstellungen")).toHaveLength(1);
    expect(text).toContain("Gespeichert werden nur die Entscheidung und der Tag, an dem Sie sie getroffen haben.");
    const de = JSON.parse(read("packages/web/src/i18n/de.json")) as { footer: { privacySettings: string } };
    expect(text).toContain(`Über den Link „${de.footer.privacySettings}“ unten auf jeder Seite sehen Sie Ihre aktuelle Entscheidung und können sie jederzeit in beide Richtungen ändern; auf Seiten ohne Analyse wird dabei auch nach einer Einwilligung nichts geladen.`);
    expect(text).toContain("daher nach § 25 Abs. 2 Nr. 2 TDDDG einwilligungsfrei.");
    expect(text).not.toContain("und sie läuft nach zwölf Monaten ab");
  });

  it("R5: every label section 5 quotes is the catalogue's `consent.accept`", () => {
    const de = JSON.parse(read("packages/web/src/i18n/de.json")) as { consent: { accept: string } };
    const quoted = [...text.matchAll(/auf „([^“]+)“ geklickt/gu)].map((m) => m[1]);
    expect(quoted.length).toBeGreaterThanOrEqual(2);
    for (const q of quoted) expect(q).toBe(de.consent.accept);
  });
});

describe("the no-tag sentence (T3)", () => {
  it("says no THIRD-PARTY analytics, and names the own count", () => {
    expect(text).toContain("Diese Seite setzt selbst kein Cookie außer den beiden unter „Sprachauswahl“ und „Schutz vor Überlastung“ beschriebenen, die nur Ihre selbst gewählte Sprache bzw. den Nachweis der bestandenen Prüfung enthalten, und verwendet keine Analyse-, Tracking- oder Werbedienste Dritter. Die eigene Besucherzählung nach Punkt 4 kommt ohne Cookies aus und verlässt unseren Server nicht.");
  });
});

describe("C1: the count is nothing the browser runs or is asked for", () => {
  const WEB = fileURLToPath(new URL("packages/web/", REPO));
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const runtime = [...walk(join(WEB, "src")), ...readdirSync(WEB).filter((n) => n.startsWith("astro.config")).map((n) => join(WEB, n))];

  it("reads every runtime file of the web package", () => {
    expect(runtime.length).toBeGreaterThan(20);
  });

  it("no runtime file asks for Client Hints or names the counter", () => {
    for (const f of runtime) {
      // Comments may NAME the counter (the privacy notice's header cites it); code may not.
      const body = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "").replace(/<!--[\s\S]*?-->/gu, "").replace(/^\s*\/\/.*$/gmu, "");
      expect(body, f).not.toMatch(/Accept-CH|Critical-CH/iu);
      expect(body, f).not.toMatch(/site[-_]visits|SITE_VISITS|visitor-count/u);
    }
  });
});
